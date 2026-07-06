import { expect, test } from "../fixtures/base";
import { ApiHelper, type UsageRow } from "../helpers/api-helper";
import { MULTI_USER_TIMEOUT } from "../helpers/constants";
import { isoDate, produceUsage, usageEnv } from "../helpers/model-usage";
import { loginAs } from "../helpers/test-user-context";

// TestRail suite 2420, Model Usage section — backend read RPC
// (get_usage_by_dimension) contract: no write surface, per-user API-key
// ownership, per-workspace isolation, and retention of deleted endpoints.
//
// Usage rows are produced through the AI gateway to a Running e2e-engine
// endpoint; opt-in via E2E_AITRACE_ENDPOINT.

const env = usageEnv();
const e = env as NonNullable<typeof env>;

const START = isoDate(-30);
const END = isoDate(0);

/** Create a user with its own logged-in ApiHelper + one owned API key. */
async function makeUserWithKey(
  admin: ApiHelper,
  browser: import("@playwright/test").Browser,
  perms: string[],
  keyWorkspaces: string[],
) {
  const ts = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email = `mu-${ts}@e2e.local`;
  const uname = `mu-${ts}`;
  const role = `mu-r-${ts}`;
  const policy = `mu-p-${ts}`;
  const uid = await admin.createUser(uname, email, "Test@123456");
  await admin.createRole(role, perms);
  await admin.createPolicy(policy, uid, role, true);
  const { page, context } = await loginAs(browser, admin, email, "Test@123456");
  const api = new ApiHelper(page);
  const keys: Array<{ name: string; sk: string; workspace: string }> = [];
  for (const ws of keyWorkspaces) {
    const keyName = `mu-key-${ws}-${ts}`;
    const { sk_value } = await api.createApiKey(keyName, { workspace: ws });
    keys.push({ name: keyName, sk: sk_value, workspace: ws });
  }
  return {
    uid,
    email,
    api,
    keys,
    cleanup: async () => {
      await context.close();
      for (const k of keys)
        await admin.deleteApiKey(k.name, { retries: 5 }).catch(() => {});
      await admin.deletePolicy(policy).catch(() => {});
      await admin.deleteRole(role, { retries: 10 }).catch(() => {});
      await admin.deleteUser(uname, { retries: 10 }).catch(() => {});
    },
  };
}

test.describe("model usage — backend read RPC", () => {
  test.skip(!env, "set E2E_AITRACE_ENDPOINT to run Model Usage RPC tests");

  test("get_usage_by_dimension is read-only: no create/update/delete surface", {
    tag: "@C2710864",
  }, async ({ apiHelper }) => {
    // Baseline: the RPC returns rows for the default workspace.
    const baseline = await apiHelper.getUsageByDimension({
      start: START,
      end: END,
      workspace: e.workspace,
    });
    expect(baseline.status).toBe(200);
    expect(Array.isArray(baseline.body)).toBe(true);

    // An admin-owned daily-usage row to probe REST writes against.
    const owned = await apiHelper.request<Array<{ id: number }>>(
      "GET",
      "/api_daily_usage?select=id&order=id.asc&limit=1",
    );
    const probeId = owned.body?.[0]?.id;

    // REST POST (insert) is denied by row-level security — no daily row is
    // ever user-creatable.
    const post = await apiHelper.request(
      "POST",
      "/api_daily_usage",
      {
        api_version: "v1",
        kind: "ApiDailyUsage",
        metadata: { name: `probe-${Date.now()}` },
        spec: {
          api_key_id: "00000000-0000-0000-0000-000000000000",
          usage_date: "2020-01-01",
          total_usage: 999999,
          dimensional_usage: {},
        },
      },
      { probe: true },
    );
    expect(post.status).toBeGreaterThanOrEqual(400);

    // The write RPCs the case probes do not exist in the OpenAPI surface.
    for (const rpc of ["create_usage", "update_usage"]) {
      const r = await apiHelper.request(
        "POST",
        `/rpc/${rpc}`,
        {},
        {
          probe: true,
        },
      );
      expect([404, 405]).toContain(r.status);
    }

    // REST PATCH/DELETE must not mutate an existing (owned, visible) row.
    if (probeId !== undefined) {
      await apiHelper.request(
        "PATCH",
        `/api_daily_usage?id=eq.${probeId}`,
        { spec: { total_usage: 424242 } },
        { probe: true },
      );
      await apiHelper.request(
        "DELETE",
        `/api_daily_usage?id=eq.${probeId}`,
        undefined,
        { probe: true },
      );
      const after = await apiHelper.request<Array<{ id: number }>>(
        "GET",
        `/api_daily_usage?select=id&id=eq.${probeId}`,
      );
      // Row still present → DELETE had no effect.
      expect(after.body?.[0]?.id).toBe(probeId);
    }

    // Re-query: the read surface is unchanged after all write attempts.
    const post2 = await apiHelper.getUsageByDimension({
      start: START,
      end: END,
      workspace: e.workspace,
    });
    expect(post2.status).toBe(200);
    expect(post2.body.length).toBe(baseline.body.length);
  });

  test(
    "usage query returns only the caller's own API keys and is workspace-isolated",
    {
      tag: "@C2710861",
      annotation: {
        type: "slow",
        description: "creates multiple users, keys and workspaces",
      },
    },
    async ({ apiHelper, browser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT + 180_000);
      const ts = Date.now();
      const ws1 = `mu-ws1-${ts}`;
      const ws2 = `mu-ws2-${ts}`;
      const cleanups: Array<() => Promise<void>> = [];
      try {
        await apiHelper.createWorkspace(ws1);
        await apiHelper.createWorkspace(ws2);
        cleanups.push(async () => {
          await apiHelper.deleteWorkspace(ws1, { force: true }).catch(() => {});
          await apiHelper.deleteWorkspace(ws2, { force: true }).catch(() => {});
        });

        // User A and User B each with an own key + usage in the default ws.
        // endpoint:read lets their key consume the internal e2e endpoint.
        const A = await makeUserWithKey(
          apiHelper,
          browser,
          ["workspace:read", "endpoint:read"],
          [e.workspace],
        );
        cleanups.push(A.cleanup);
        const B = await makeUserWithKey(
          apiHelper,
          browser,
          ["workspace:read", "endpoint:read"],
          [e.workspace],
        );
        cleanups.push(B.cleanup);

        const rowA = await produceUsage(A.api, e, A.keys[0].sk, {
          completionTokens: 11,
        });
        const rowB = await produceUsage(B.api, e, B.keys[0].sk, {
          completionTokens: 13,
        });

        // A sees only A's key; B sees only B's key.
        const aList = await A.api.getUsageByDimension({
          start: START,
          end: END,
          workspace: e.workspace,
        });
        expect(aList.status).toBe(200);
        expect(aList.body.every((r) => r.api_key_id === rowA.api_key_id)).toBe(
          true,
        );
        expect(aList.body.some((r) => r.api_key_id === rowB.api_key_id)).toBe(
          false,
        );

        const bList = await B.api.getUsageByDimension({
          start: START,
          end: END,
          workspace: e.workspace,
        });
        expect(bList.status).toBe(200);
        expect(bList.body.every((r) => r.api_key_id === rowB.api_key_id)).toBe(
          true,
        );

        // A cannot escalate by passing B's key id → empty result set.
        const escalate = await A.api.getUsageByDimension({
          start: START,
          end: END,
          workspace: e.workspace,
          apiKeyId: rowB.api_key_id,
        });
        expect(escalate.status).toBe(200);
        expect(escalate.body.length).toBe(0);

        // Workspace isolation: a user with keys in ws1 and ws2 sees each
        // workspace's usage only under the matching p_workspace. Each key
        // consumes a per-workspace external endpoint proxying to the shared
        // e2e engine, so usage is attributed to the key's workspace.
        const D = await makeUserWithKey(
          apiHelper,
          browser,
          ["workspace:read", "external_endpoint:read"],
          [ws1, ws2],
        );
        cleanups.push(D.cleanup);
        const dKey1 = D.keys.find((k) => k.workspace === ws1) as {
          sk: string;
        };
        const dKey2 = D.keys.find((k) => k.workspace === ws2) as {
          sk: string;
        };
        const upstream = `${e.gateway.replace(/:\d+$/, "")}:8000/${e.workspace}/${e.endpoint}/v1`;
        const ee1 = `mu-ee1-${ts}`;
        const ee2 = `mu-ee2-${ts}`;
        await apiHelper.createExternalEndpoint(
          ee1,
          upstream,
          { any: "any" },
          {
            workspace: ws1,
          },
        );
        await apiHelper.createExternalEndpoint(
          ee2,
          upstream,
          { any: "any" },
          {
            workspace: ws2,
          },
        );
        cleanups.push(async () => {
          await apiHelper
            .deleteExternalEndpoint(ee1, { force: true })
            .catch(() => {});
          await apiHelper
            .deleteExternalEndpoint(ee2, { force: true })
            .catch(() => {});
        });
        const matchByUsage = (u: number) => (row: UsageRow) => row.usage === u;
        await produceUsage(D.api, e, dKey1.sk, {
          completionTokens: 17,
          external: true,
          endpoint: ee1,
          workspace: ws1,
          match: matchByUsage(20),
          timeoutMs: 150_000,
        });
        await produceUsage(D.api, e, dKey2.sk, {
          completionTokens: 19,
          external: true,
          endpoint: ee2,
          workspace: ws2,
          match: matchByUsage(22),
          timeoutMs: 150_000,
        });

        const d1 = await D.api.getUsageByDimension({
          start: START,
          end: END,
          workspace: ws1,
        });
        expect(d1.status).toBe(200);
        expect(d1.body.length).toBeGreaterThan(0);
        expect(d1.body.every((r) => r.workspace === ws1)).toBe(true);

        const d2 = await D.api.getUsageByDimension({
          start: START,
          end: END,
          workspace: ws2,
        });
        expect(d2.status).toBe(200);
        expect(d2.body.length).toBeGreaterThan(0);
        expect(d2.body.every((r) => r.workspace === ws2)).toBe(true);
        // Disjoint: no ws1 key appears under ws2.
        const ws1Keys = new Set(d1.body.map((r) => r.api_key_id));
        expect(d2.body.some((r) => ws1Keys.has(r.api_key_id))).toBe(false);
      } finally {
        for (const c of cleanups.reverse()) await c().catch(() => {});
      }
    },
  );

  test(
    "deleted endpoint's historical usage is retained and still queryable",
    {
      tag: "@C2710862",
      annotation: {
        type: "slow",
        description: "creates an external endpoint, produces usage, deletes it",
      },
    },
    async ({ apiHelper, browser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT + 150_000);
      const ts = Date.now();
      const eeName = `mu-del-${ts}`;
      const cleanups: Array<() => Promise<void>> = [];
      try {
        const U = await makeUserWithKey(
          apiHelper,
          browser,
          ["workspace:read", "external_endpoint:read"],
          [e.workspace],
        );
        cleanups.push(U.cleanup);

        // An external endpoint proxying to the e2e engine, so a call through it
        // records usage against endpoint_name = eeName.
        await apiHelper.createExternalEndpoint(
          eeName,
          `${e.gateway.replace(/:\d+$/, "")}:8000/${e.workspace}/${e.endpoint}/v1`,
          { any: "any" },
        );
        cleanups.push(() =>
          apiHelper.deleteExternalEndpoint(eeName, { force: true }),
        );

        // Wait for the gateway route to go live, then produce an external trace.
        const row = await produceUsage(U.api, e, U.keys[0].sk, {
          completionTokens: 23,
          external: true,
          endpoint: eeName,
          match: (r) => r.endpoint_name === eeName,
          timeoutMs: 150_000,
        });
        expect(row.endpoint_name).toBe(eeName);
        expect(row.workspace).toBe(e.workspace);
        expect(row.usage).toBeGreaterThan(0);

        // Delete the endpoint.
        await apiHelper.deleteExternalEndpoint(eeName, { force: true });

        // Historical usage survives the endpoint deletion and is still returned
        // under the original workspace.
        const after = await U.api.getUsageByDimension({
          start: START,
          end: END,
          workspace: e.workspace,
        });
        expect(after.status).toBe(200);
        const kept = after.body.find((r) => r.endpoint_name === eeName);
        expect(kept).toBeDefined();
        expect(kept?.workspace).toBe(e.workspace);
        expect((kept?.usage ?? 0) > 0).toBe(true);
      } finally {
        for (const c of cleanups.reverse()) await c().catch(() => {});
      }
    },
  );

  test(
    "same-named keys/endpoints across workspaces: no loss, correct union",
    {
      tag: "@C2710863",
      annotation: {
        type: "slow",
        description: "same display names in two workspaces, then union query",
      },
    },
    async ({ apiHelper, browser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT + 200_000);
      const ts = Date.now();
      const wsA = `mu-sa-${ts}`;
      const wsB = `mu-sb-${ts}`;
      const sameKey = `mu-key-same-${ts}`;
      const sameEe = `mu-ee-same-${ts}`;
      const cleanups: Array<() => Promise<void>> = [];
      try {
        await apiHelper.createWorkspace(wsA);
        await apiHelper.createWorkspace(wsB);
        cleanups.push(async () => {
          await apiHelper.deleteWorkspace(wsA, { force: true }).catch(() => {});
          await apiHelper.deleteWorkspace(wsB, { force: true }).catch(() => {});
        });

        // One user with same-named keys in both workspaces.
        const ts2 = `${ts}`;
        const email = `mu-same-${ts2}@e2e.local`;
        const uname = `mu-same-${ts2}`;
        const role = `mu-same-r-${ts2}`;
        const policy = `mu-same-p-${ts2}`;
        const uid = await apiHelper.createUser(uname, email, "Test@123456");
        await apiHelper.createRole(role, [
          "workspace:read",
          "external_endpoint:read",
        ]);
        await apiHelper.createPolicy(policy, uid, role, true);
        const { page, context } = await loginAs(
          browser,
          apiHelper,
          email,
          "Test@123456",
        );
        const userApi = new ApiHelper(page);
        cleanups.push(async () => {
          await context.close();
          await apiHelper.deleteApiKey(sameKey, { retries: 5 }).catch(() => {});
          await apiHelper.deletePolicy(policy).catch(() => {});
          await apiHelper.deleteRole(role, { retries: 10 }).catch(() => {});
          await apiHelper.deleteUser(uname, { retries: 10 }).catch(() => {});
        });

        const keyA = await userApi.createApiKey(sameKey, { workspace: wsA });
        const keyB = await userApi.createApiKey(sameKey, { workspace: wsB });

        const upstream = `${e.gateway.replace(/:\d+$/, "")}:8000/${e.workspace}/${e.endpoint}/v1`;
        await apiHelper.createExternalEndpoint(
          sameEe,
          upstream,
          { any: "any" },
          {
            workspace: wsA,
          },
        );
        await apiHelper.createExternalEndpoint(
          sameEe,
          upstream,
          { any: "any" },
          {
            workspace: wsB,
          },
        );
        cleanups.push(async () => {
          await apiHelper
            .deleteExternalEndpoint(sameEe, { force: true })
            .catch(() => {});
        });

        // Distinct usage per workspace: U-A total 20, U-B total 25.
        const rowA = await produceUsage(userApi, e, keyA.sk_value, {
          completionTokens: 17,
          external: true,
          endpoint: sameEe,
          workspace: wsA,
          match: (r) => r.usage === 20,
          timeoutMs: 180_000,
        });
        const rowB = await produceUsage(userApi, e, keyB.sk_value, {
          completionTokens: 22,
          external: true,
          endpoint: sameEe,
          workspace: wsB,
          match: (r) => r.usage === 25,
          timeoutMs: 180_000,
        });
        expect(rowA.api_key_id).not.toBe(rowB.api_key_id);

        // Single-workspace queries return only that workspace's rows, with the
        // shared display names intact.
        const qa = await userApi.getUsageByDimension({
          start: START,
          end: END,
          workspace: wsA,
        });
        expect(qa.body.every((r) => r.workspace === wsA)).toBe(true);
        expect(
          qa.body.some(
            (r) =>
              r.api_key_name === sameKey &&
              r.endpoint_name === sameEe &&
              r.api_key_id === rowA.api_key_id,
          ),
        ).toBe(true);
        expect(qa.body.some((r) => r.api_key_id === rowB.api_key_id)).toBe(
          false,
        );

        const qb = await userApi.getUsageByDimension({
          start: START,
          end: END,
          workspace: wsB,
        });
        expect(qb.body.every((r) => r.workspace === wsB)).toBe(true);
        expect(qb.body.some((r) => r.api_key_id === rowB.api_key_id)).toBe(
          true,
        );

        // Union (no p_workspace): both keys present, no loss, no duplication.
        const union = await userApi.getUsageByDimension({
          start: START,
          end: END,
        });
        const idsA = union.body.filter(
          (r) => r.api_key_id === rowA.api_key_id && r.workspace === wsA,
        );
        const idsB = union.body.filter(
          (r) => r.api_key_id === rowB.api_key_id && r.workspace === wsB,
        );
        expect(idsA.length).toBeGreaterThan(0);
        expect(idsB.length).toBeGreaterThan(0);
        const sumA = idsA.reduce((s, r) => s + r.usage, 0);
        const sumB = idsB.reduce((s, r) => s + r.usage, 0);
        expect(sumA).toBe(20);
        expect(sumB).toBe(25);
      } finally {
        for (const c of cleanups.reverse()) await c().catch(() => {});
      }
    },
  );
});
