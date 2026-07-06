import type { Browser } from "@playwright/test";
import { expect, test } from "../fixtures/base";
import { ApiHelper } from "../helpers/api-helper";
import { MULTI_USER_TIMEOUT } from "../helpers/constants";
import { isoDate, produceUsage, usageEnv } from "../helpers/model-usage";
import { loginAs } from "../helpers/test-user-context";

// TestRail suite 2420, Model Usage section — permission (RBAC) behavior of the
// get_usage_by_dimension RPC and the Model Usage page.
//
// Per-workspace `workspace:usage-read` scoping requires the enterprise
// workspace-aware `has_permission` (community treats non-global assignments as
// inert and usage-read as a global check). Opt-in via E2E_AITRACE_ENDPOINT and
// run against an enterprise-scoped control plane.

const env = usageEnv();
const e = env as NonNullable<typeof env>;
const START = isoDate(-30);
const END = isoDate(0);

let seq = 0;
const uid8 = () => `${Date.now()}${seq++}`;

/**
 * Seed usage in `workspace` owned by a fresh producer user: creates the user
 * (workspace:read + external_endpoint:read, workspace-scoped), an owned key, a
 * per-workspace external endpoint proxying to the e2e engine, and produces one
 * usage record. Returns the producer's key identity + a cleanup.
 */
async function seedUsage(
  admin: ApiHelper,
  browser: Browser,
  workspace: string,
  completionTokens: number,
) {
  const id = uid8();
  const email = `mu-prod-${id}@e2e.local`;
  const uname = `mu-prod-${id}`;
  const role = `mu-prod-r-${id}`;
  const policy = `mu-prod-p-${id}`;
  const keyName = `mu-prod-key-${id}`;
  const eeName = `mu-prod-ee-${id}`;
  const uidVal = await admin.createUser(uname, email, "Test@123456");
  await admin.createRole(role, ["workspace:read", "external_endpoint:read"]);
  await admin.createPolicy(policy, uidVal, role, false, workspace);
  const { page, context } = await loginAs(browser, admin, email, "Test@123456");
  const api = new ApiHelper(page);
  const { sk_value } = await api.createApiKey(keyName, { workspace });
  const upstream = `${e.gateway.replace(/:\d+$/, "")}:8000/${e.workspace}/${e.endpoint}/v1`;
  await admin.createExternalEndpoint(
    eeName,
    upstream,
    { any: "any" },
    {
      workspace,
    },
  );
  const row = await produceUsage(api, e, sk_value, {
    completionTokens,
    external: true,
    endpoint: eeName,
    workspace,
    match: (r) => r.endpoint_name === eeName && r.usage > 0,
    timeoutMs: 180_000,
  });
  return {
    api,
    uid: uidVal,
    role,
    keyId: row.api_key_id,
    keyName,
    eeName,
    row,
    cleanup: async () => {
      await context.close();
      await admin
        .deleteExternalEndpoint(eeName, { force: true })
        .catch(() => {});
      await admin.deleteApiKey(keyName, { retries: 5 }).catch(() => {});
      await admin.deletePolicy(policy).catch(() => {});
      await admin.deleteRole(role, { retries: 10 }).catch(() => {});
      await admin.deleteUser(uname, { retries: 10 }).catch(() => {});
    },
  };
}

/**
 * A reader user (no own key) with a workspace-scoped role. Returns its logged-in
 * ApiHelper plus `setPermissions()` (edits the role in place — takes effect
 * immediately, unlike soft-deleting the assignment which lingers until GC) and
 * cleanup.
 */
async function makeReader(
  admin: ApiHelper,
  browser: Browser,
  permissions: string[],
  workspace: string,
) {
  const id = uid8();
  const email = `mu-read-${id}@e2e.local`;
  const uname = `mu-read-${id}`;
  const role = `mu-read-r-${id}`;
  const policy = `mu-read-p-${id}`;
  const uidVal = await admin.createUser(uname, email, "Test@123456");
  await admin.createRole(role, permissions);
  await admin.createPolicy(policy, uidVal, role, false, workspace);
  const { page, context } = await loginAs(browser, admin, email, "Test@123456");
  return {
    api: new ApiHelper(page),
    uid: uidVal,
    email,
    role,
    setPermissions: (perms: string[]) => admin.updateRole(role, perms),
    cleanup: async () => {
      await context.close();
      await admin.deletePolicy(policy).catch(() => {});
      await admin.deleteRole(role, { retries: 10 }).catch(() => {});
      await admin.deleteUser(uname, { retries: 10 }).catch(() => {});
    },
  };
}

test.describe("model usage — RBAC", () => {
  test.skip(!env, "set E2E_AITRACE_ENDPOINT to run Model Usage RBAC tests");

  test(
    "workspace:read alone enters the page and sees own usage; no read → no visibility",
    {
      tag: "@C2710866",
      annotation: { type: "slow", description: "workspace + producer + usage" },
    },
    async ({ apiHelper, browser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT + 200_000);
      const ws = `mu-perm-${uid8()}`;
      const cleanups: Array<() => Promise<void>> = [];
      try {
        await apiHelper.createWorkspace(ws);
        cleanups.push(() =>
          apiHelper.deleteWorkspace(ws, { force: true }).then(
            () => {},
            () => {},
          ),
        );
        // The reader owns usage in ws (produced with its own key).
        const reader = await seedUsage(apiHelper, browser, ws, 7);
        cleanups.push(reader.cleanup);

        // workspace:read (workspace-scoped) is enough to read own usage.
        const list = await reader.api.getUsageByDimension({
          start: START,
          end: END,
          workspace: ws,
        });
        expect(list.status).toBe(200);
        expect(list.body.some((r) => r.api_key_id === reader.keyId)).toBe(true);

        // The Model Usage page loads for this user.
        await reader.api.page.goto(`/#/${ws}/model-usage`);
        await expect(
          reader.api.page.getByText("No usage in the selected window."),
        ).toHaveCount(0, { timeout: 15_000 });

        // A user with no read on ws sees no usage there (no leak).
        const outsider = await makeReader(
          apiHelper,
          browser,
          ["workspace:read"],
          `mu-other-${uid8()}`,
        );
        cleanups.push(outsider.cleanup);
        const denied = await outsider.api.getUsageByDimension({
          start: START,
          end: END,
          workspace: ws,
        });
        expect(denied.status).toBe(200);
        expect(denied.body.length).toBe(0);
      } finally {
        for (const c of cleanups.reverse()) await c().catch(() => {});
      }
    },
  );

  test(
    "without usage-read, different users in the same workspace see only their own keys",
    {
      tag: "@C2710867",
      annotation: { type: "slow", description: "two producers in one ws" },
    },
    async ({ apiHelper, browser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT + 260_000);
      const ws = `mu-coexist-${uid8()}`;
      const cleanups: Array<() => Promise<void>> = [];
      try {
        await apiHelper.createWorkspace(ws);
        cleanups.push(() =>
          apiHelper.deleteWorkspace(ws, { force: true }).then(
            () => {},
            () => {},
          ),
        );
        const A = await seedUsage(apiHelper, browser, ws, 9);
        cleanups.push(A.cleanup);
        const B = await seedUsage(apiHelper, browser, ws, 11);
        cleanups.push(B.cleanup);

        // A sees only A's key; B sees only B's key (default isolation).
        const aList = await A.api.getUsageByDimension({
          start: START,
          end: END,
          workspace: ws,
        });
        expect(aList.body.every((r) => r.api_key_id === A.keyId)).toBe(true);
        expect(aList.body.some((r) => r.api_key_id === B.keyId)).toBe(false);

        const bList = await B.api.getUsageByDimension({
          start: START,
          end: END,
          workspace: ws,
        });
        expect(bList.body.every((r) => r.api_key_id === B.keyId)).toBe(true);
        expect(bList.body.some((r) => r.api_key_id === A.keyId)).toBe(false);
      } finally {
        for (const c of cleanups.reverse()) await c().catch(() => {});
      }
    },
  );

  test(
    "workspace:usage-read reveals all keys; revoking it returns to own-key-only",
    {
      tag: ["@C2710870", "@C2710871"],
      annotation: { type: "slow", description: "operator over two producers" },
    },
    async ({ apiHelper, browser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT + 300_000);
      const ws = `mu-usage-${uid8()}`;
      const cleanups: Array<() => Promise<void>> = [];
      try {
        await apiHelper.createWorkspace(ws);
        cleanups.push(() =>
          apiHelper.deleteWorkspace(ws, { force: true }).then(
            () => {},
            () => {},
          ),
        );
        const A = await seedUsage(apiHelper, browser, ws, 9);
        cleanups.push(A.cleanup);
        const B = await seedUsage(apiHelper, browser, ws, 11);
        cleanups.push(B.cleanup);

        // Operator with usage-read (workspace-scoped) sees BOTH keys.
        const operator = await makeReader(
          apiHelper,
          browser,
          ["workspace:read", "workspace:usage-read"],
          ws,
        );
        cleanups.push(operator.cleanup);
        const full = await operator.api.getUsageByDimension({
          start: START,
          end: END,
          workspace: ws,
        });
        expect(full.status).toBe(200);
        expect(full.body.some((r) => r.api_key_id === A.keyId)).toBe(true);
        expect(full.body.some((r) => r.api_key_id === B.keyId)).toBe(true);

        // Filtering to one key returns only that key (C2710870 filter step).
        const onlyA = await operator.api.getUsageByDimension({
          start: START,
          end: END,
          workspace: ws,
          apiKeyId: A.keyId,
        });
        expect(onlyA.body.every((r) => r.api_key_id === A.keyId)).toBe(true);
        expect(onlyA.body.length).toBeGreaterThan(0);

        // Revoke usage-read → operator (no own key) now sees nothing (C2710871).
        await operator.setPermissions(["workspace:read"]);
        const afterRevoke = await operator.api.getUsageByDimension({
          start: START,
          end: END,
          workspace: ws,
        });
        expect(afterRevoke.status).toBe(200);
        expect(afterRevoke.body.some((r) => r.api_key_id === A.keyId)).toBe(
          false,
        );
        expect(afterRevoke.body.some((r) => r.api_key_id === B.keyId)).toBe(
          false,
        );

        // A, as a plain member, still only ever saw its own key.
        const aList = await A.api.getUsageByDimension({
          start: START,
          end: END,
          workspace: ws,
        });
        expect(aList.body.some((r) => r.api_key_id === B.keyId)).toBe(false);
      } finally {
        for (const c of cleanups.reverse()) await c().catch(() => {});
      }
    },
  );

  test(
    "a workspace without read cannot be mixed in via selector, URL, or query",
    {
      tag: "@C2710868",
      annotation: { type: "slow", description: "denied workspace isolation" },
    },
    async ({ apiHelper, browser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT + 240_000);
      const allowed = `mu-allow-${uid8()}`;
      const denied = `mu-deny-${uid8()}`;
      const cleanups: Array<() => Promise<void>> = [];
      try {
        await apiHelper.createWorkspace(allowed);
        await apiHelper.createWorkspace(denied);
        cleanups.push(async () => {
          await apiHelper
            .deleteWorkspace(allowed, { force: true })
            .catch(() => {});
          await apiHelper
            .deleteWorkspace(denied, { force: true })
            .catch(() => {});
        });
        // Someone else's usage lives in the denied workspace.
        const other = await seedUsage(apiHelper, browser, denied, 13);
        cleanups.push(other.cleanup);
        // Our user can read `allowed` but has no grant on `denied`.
        const user = await makeReader(
          apiHelper,
          browser,
          ["workspace:read"],
          allowed,
        );
        cleanups.push(user.cleanup);

        // Explicit p_workspace = denied must not leak the other user's usage.
        const probe = await user.api.getUsageByDimension({
          start: START,
          end: END,
          workspace: denied,
        });
        expect(probe.status).toBe(200);
        expect(probe.body.some((r) => r.api_key_id === other.keyId)).toBe(
          false,
        );

        // The "All workspaces" union (no p_workspace) also excludes denied.
        const union = await user.api.getUsageByDimension({
          start: START,
          end: END,
        });
        expect(union.body.some((r) => r.workspace === denied)).toBe(false);
        expect(union.body.some((r) => r.api_key_id === other.keyId)).toBe(
          false,
        );
      } finally {
        for (const c of cleanups.reverse()) await c().catch(() => {});
      }
    },
  );

  test(
    "revoking workspace:read removes usage visibility with no residual data",
    {
      tag: "@C2710869",
      annotation: { type: "slow", description: "revoke read mid-session" },
    },
    async ({ apiHelper, browser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT + 200_000);
      const ws = `mu-revoke-${uid8()}`;
      const cleanups: Array<() => Promise<void>> = [];
      try {
        await apiHelper.createWorkspace(ws);
        cleanups.push(() =>
          apiHelper.deleteWorkspace(ws, { force: true }).then(
            () => {},
            () => {},
          ),
        );
        // The user owns usage in ws.
        const user = await seedUsage(apiHelper, browser, ws, 15);
        cleanups.push(user.cleanup);

        // Before revoke: the workspace is accessible and the page loads its usage.
        const wsBefore = await user.api.request<Array<{ metadata: unknown }>>(
          "GET",
          `/workspaces?select=metadata&metadata->>name=eq.${ws}`,
        );
        expect(wsBefore.body.length).toBe(1);
        await user.api.page.goto(`/#/${ws}/model-usage`);
        await expect(user.api.page).toHaveURL(new RegExp(`/${ws}/model-usage`));

        // Revoke workspace:read by editing the producer's role in place (the
        // workspaces RLS read policy is has_permission('workspace:read', ws), so
        // this takes effect immediately). Keep external_endpoint:read so only
        // read is revoked.
        await apiHelper.updateRole(user.role, ["external_endpoint:read"]);

        // After revoke: the workspace is no longer accessible to the user, so it
        // cannot be selected/opened and no prior data can be re-fetched.
        const wsAfter = await user.api.request<Array<{ metadata: unknown }>>(
          "GET",
          `/workspaces?select=metadata&metadata->>name=eq.${ws}`,
        );
        expect(wsAfter.body.length).toBe(0);
      } finally {
        for (const c of cleanups.reverse()) await c().catch(() => {});
      }
    },
  );
});
