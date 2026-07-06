import { expect, test } from "../fixtures/base";
import { aiTraceEnv, chatCompletion, waitForTrace } from "../helpers/ai-trace";
import { ApiHelper } from "../helpers/api-helper";
import { MULTI_USER_TIMEOUT } from "../helpers/constants";
import { loginAs } from "../helpers/test-user-context";

type Trace = Record<string, unknown>;

// TestRail suite 2420, Access Log section — permission (workspace) filtering.
//
// Per-workspace trace-read scoping requires the enterprise workspace-aware
// `has_permission` (community treats non-global assignments as inert). Opt-in
// via E2E_AITRACE_ENDPOINT; run against an enterprise-scoped control plane.
//
// NOTE: per-ENDPOINT trace-read scoping (C2710833/834/835 as "IE_A but not
// IE_B" in the same workspace/type) is not expressible in the product — the
// finest granularity is workspace × endpoint_type — so those are not covered.

const env = aiTraceEnv();
const e = env as NonNullable<typeof env>;

test.describe("access log — workspace RBAC", () => {
  test.skip(!env, "set E2E_AITRACE_ENDPOINT to run Access Log RBAC tests");

  test(
    "workspace-scoped trace-read: authorized workspace readable, unauthorized 403",
    {
      tag: "@C2710832",
      annotation: {
        type: "slow",
        description: "creates a workspace-scoped user + a second workspace",
      },
    },
    async ({ apiHelper, browser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT + 90_000);
      const ts = Date.now();
      const otherWs = `rbac-b-${ts}`;
      const userName = `rbac-u-${ts}`;
      const email = `rbac-u-${ts}@e2e.local`;
      const roleName = `rbac-r-${ts}`;
      const policyName = `rbac-p-${ts}`;
      const keyName = `rbac-key-${ts}`;
      let userCtx: Awaited<ReturnType<typeof loginAs>>["context"] | undefined;

      const { sk_value } = await apiHelper.createApiKey(keyName);
      try {
        // Seed a trace in the authorized workspace so it is non-empty.
        await chatCompletion(e, sk_value, {
          mode: "fixed",
          text: `rbac-${ts}`,
          completion_tokens: 5,
        });

        // A second (unauthorized) workspace and a user scoped ONLY to the
        // authorized workspace.
        await apiHelper.createWorkspace(otherWs);
        const userId = await apiHelper.createUser(
          userName,
          email,
          "Test@123456",
        );
        await apiHelper.createRole(roleName, [
          "workspace:read",
          "endpoint:trace-read",
          "external_endpoint:trace-read",
        ]);
        await apiHelper.createPolicy(
          policyName,
          userId,
          roleName,
          false,
          e.workspace,
        );

        const { page, context } = await loginAs(
          browser,
          apiHelper,
          email,
          "Test@123456",
        );
        userCtx = context;
        const userApi = new ApiHelper(page);

        // Authorized workspace: readable.
        const okList = await userApi.listAITraces(e.workspace, { limit: 10 });
        expect(okList.status).toBe(200);
        const okStats = await userApi.getAITraceStats(e.workspace, { days: 7 });
        expect(okStats.status).toBe(200);

        // Unauthorized workspace: 403 across list, stats and detail, with no
        // cross-workspace data leak.
        const deniedList = await userApi.listAITraces(otherWs, { limit: 50 });
        expect(deniedList.status).toBe(403);
        const deniedStats = await userApi.getAITraceStats(otherWs, { days: 7 });
        expect(deniedStats.status).toBe(403);
        const deniedDetail = await userApi.getAITrace(otherWs, `probe-${ts}`);
        expect(deniedDetail.status).toBe(403);
      } finally {
        if (userCtx) await userCtx.close();
        await apiHelper.deletePolicy(policyName).catch(() => {});
        await apiHelper.deleteRole(roleName, { retries: 10 }).catch(() => {});
        await apiHelper.deleteUser(userName, { retries: 10 }).catch(() => {});
        await apiHelper
          .deleteWorkspace(otherWs, { force: true })
          .catch(() => {});
        await apiHelper.deleteApiKey(keyName).catch(() => {});
      }
    },
  );

  // The product's trace-read granularity is workspace × endpoint_type (there is
  // no per-endpoint grant), so this exercises the endpoint_type dimension:
  // external_endpoint:trace-read exposes external-endpoint (model gateway)
  // traces and NOT internal ones, and vice-versa. Per-gateway EE_X/EE_Y
  // filtering (the literal C2710834) is not expressible.
  test(
    "external_endpoint:trace-read scopes visibility to external-endpoint traces",
    {
      tag: "@C2710834",
      annotation: {
        type: "slow",
        description: "creates an external endpoint + two type-scoped users",
      },
    },
    async ({ apiHelper, browser }, testInfo) => {
      testInfo.setTimeout(MULTI_USER_TIMEOUT + 150_000);
      const ts = Date.now();
      const eeName = `e2e-ext-${ts}`;
      const eeModel = `e2e-ext-model-${ts}`;
      const keyName = `type-key-${ts}`;
      const host = (env as NonNullable<typeof env>).gateway.replace(
        /:\d+$/,
        "",
      );
      const ctxs: Array<Awaited<ReturnType<typeof loginAs>>["context"]> = [];
      const created: Array<() => Promise<void>> = [];

      const { sk_value } = await apiHelper.createApiKey(keyName);
      try {
        // An internal-endpoint trace (e2e-smoke).
        await chatCompletion(e, sk_value, {
          mode: "fixed",
          text: `int-${ts}`,
          completion_tokens: 5,
        });

        // A model gateway (external endpoint) proxying to the e2e engine, so a
        // call through it yields an external-endpoint trace.
        await apiHelper.createExternalEndpoint(
          eeName,
          `${host}:8000/${e.workspace}/${e.endpoint}/v1`,
          { [eeModel]: "any" },
        );
        created.push(() =>
          apiHelper.deleteExternalEndpoint(eeName, { force: true }),
        );
        // Wait until the gateway route is live, then produce an external trace.
        const extTrace = await (async () => {
          const deadline = Date.now() + 90_000;
          while (Date.now() < deadline) {
            const gw = await chatCompletion(
              e,
              sk_value,
              { mode: "canned" },
              { external: true, endpoint: eeName, model: eeModel },
            );
            if (gw.status === 200) {
              return await waitForTrace(
                apiHelper,
                e.workspace,
                (it) =>
                  it.endpoint_name === eeName &&
                  it.endpoint_type === "external-endpoint",
                { timeoutMs: 60_000 },
              );
            }
            await new Promise((r) => setTimeout(r, 5000));
          }
          throw new Error("external endpoint never returned 200");
        })();
        expect(extTrace.endpoint_type).toBe("external-endpoint");

        // Helper: create a global user holding exactly one trace-read permission.
        const makeUser = async (perms: string[]) => {
          const uts = Date.now() + Math.floor(performance.now());
          const email = `type-u-${uts}@e2e.local`;
          const role = `type-r-${uts}`;
          const policy = `type-p-${uts}`;
          const uname = `type-u-${uts}`;
          const uid = await apiHelper.createUser(uname, email, "Test@123456");
          await apiHelper.createRole(role, ["workspace:read", ...perms]);
          await apiHelper.createPolicy(policy, uid, role, true);
          created.push(async () => {
            await apiHelper.deletePolicy(policy).catch(() => {});
            await apiHelper.deleteRole(role, { retries: 10 }).catch(() => {});
            await apiHelper.deleteUser(uname, { retries: 10 }).catch(() => {});
          });
          const { page, context } = await loginAs(
            browser,
            apiHelper,
            email,
            "Test@123456",
          );
          ctxs.push(context);
          return new ApiHelper(page);
        };

        // A: internal-only trace-read → sees internal, not the external trace.
        const internalUser = await makeUser(["endpoint:trace-read"]);
        const aList = await internalUser.listAITraces<{ items: Trace[] }>(
          e.workspace,
          { limit: 50 },
        );
        expect(aList.status).toBe(200);
        expect(
          aList.body.items.every((i) => i.endpoint_type === "endpoint"),
        ).toBe(true);
        expect(aList.body.items.some((i) => i.endpoint_name === eeName)).toBe(
          false,
        );

        // B: external-only trace-read → sees the external trace, not internal.
        const externalUser = await makeUser(["external_endpoint:trace-read"]);
        const bList = await externalUser.listAITraces<{ items: Trace[] }>(
          e.workspace,
          { limit: 50 },
        );
        expect(bList.status).toBe(200);
        expect(
          bList.body.items.every(
            (i) => i.endpoint_type === "external-endpoint",
          ),
        ).toBe(true);
        expect(bList.body.items.some((i) => i.endpoint_name === eeName)).toBe(
          true,
        );
        expect(
          bList.body.items.some((i) => i.endpoint_name === e.endpoint),
        ).toBe(false);
      } finally {
        for (const c of ctxs) await c.close();
        for (const undo of created.reverse()) await undo().catch(() => {});
        await apiHelper.deleteApiKey(keyName).catch(() => {});
      }
    },
  );
});
