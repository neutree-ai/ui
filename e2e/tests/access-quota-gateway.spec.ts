import { expect, test } from "../fixtures/base";
import {
  burst,
  errorCode,
  errorMessage,
  exhaustQuota,
  infer,
  waitForReject,
  waitGatewayReady,
} from "../helpers/access-quota";
import type { ApiHelper, ApiKeyLimits } from "../helpers/api-helper";
import { engineHost, usageEnv } from "../helpers/model-usage";

// TestRail suite 2420, Quota & Access Control — gateway interception + access
// strategy. These drive real inferences through the AI
// gateway to a Running e2e-engine endpoint and assert the Kong access/quota
// plugins reject over-limit / disallowed requests with the documented status +
// error code. Opt-in via E2E_AITRACE_ENDPOINT.
//
// The error contract (from neutree-ai-access priority 895 + neutree-ai-quota
// priority 890; access runs before quota):
//   disabled           -> 403 key_disabled          "This API key is disabled"
//   model not allowed   -> 403 model_not_permitted   "Model not permitted for this API key"
//   concurrency exceeded-> 429 concurrency_exceeded  "Concurrency limit exceeded for this API key"
//   rate limit exceeded -> 429 rate_limit_exceeded   "Request rate limit exceeded for this API key"
//   token quota exceeded-> 429 quota_exceeded        "Token quota exceeded for this API key"

const env = usageEnv();
const e = env as NonNullable<typeof env>;

/** Big quota so a token-quota rule never interferes with a rate/access test. */
const BIG_QUOTA = 100_000_000;

function uid(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/** Per-test bag that tracks created keys / external endpoints for cleanup. */
function tracker(admin: ApiHelper) {
  const keys: string[] = [];
  const endpoints: string[] = [];
  return {
    async key(
      limits: ApiKeyLimits | null,
      tag = "k",
    ): Promise<{ id: string; sk: string; name: string }> {
      const name = `aq-${tag}-${uid()}`;
      const { id, sk_value } = await admin.createApiKeyWithLimits(name, {
        workspace: e.workspace,
        limits,
      });
      keys.push(name);
      return { id, sk: sk_value, name };
    },
    /** External endpoint proxying to the shared engine, exposing two client
     * model names so an allowlist can permit one and deny the other. */
    async twoModelEndpoint(allow: string, deny: string): Promise<string> {
      const name = `aq-ee-${uid()}`;
      const upstream = `${engineHost(e)}:8000/${e.workspace}/${e.endpoint}/v1`;
      await admin.createExternalEndpoint(
        name,
        upstream,
        { [allow]: "any", [deny]: "any" },
        { workspace: e.workspace },
      );
      endpoints.push(name);
      return name;
    },
    async cleanup() {
      for (const k of keys)
        await admin.deleteApiKey(k, { retries: 5 }).catch(() => {});
      for (const ep of endpoints)
        await admin.deleteExternalEndpoint(ep, { retries: 5 }).catch(() => {});
    },
  };
}

test.describe("access & quota — gateway interception", () => {
  test.skip(!env, "set E2E_AITRACE_ENDPOINT to run gateway interception tests");

  test("token quota exhausted → 429 quota_exceeded", {
    tag: "@C2727093",
  }, async ({ apiHelper }) => {
    test.setTimeout(180_000);
    const t = tracker(apiHelper);
    try {
      const key = await t.key(
        { token_quota: { limit: 120, period: "daily" } },
        "quota",
      );
      // Baseline: within budget the first inference succeeds.
      await waitGatewayReady(e, key.sk, {
        workspace: e.workspace,
        completionTokens: 40,
        promptTokens: 10,
      });
      // Spend until the aggregated ledger drives remaining ≤ 0.
      const rejected = await exhaustQuota(apiHelper, e, key.sk, {
        workspace: e.workspace,
        completionTokens: 40,
        promptTokens: 10,
      });
      expect(rejected.status).toBe(429);
      expect(errorCode(rejected.body)).toBe("quota_exceeded");
      expect(errorMessage(rejected.body)).toBe(
        "Token quota exceeded for this API key",
      );
      // get_api_key_remaining is now ≤ 0.
      const remaining = await apiHelper.getApiKeyRemaining(key.id);
      expect(remaining.status).toBe(200);
      expect(Number(remaining.body)).toBeLessThanOrEqual(0);
    } finally {
      await t.cleanup();
    }
  });

  test("per-second and per-minute rate limits reject independently", {
    tag: "@C2727094",
  }, async ({ apiHelper }) => {
    test.setTimeout(200_000);
    const t = tracker(apiHelper);
    try {
      const rps = 2;
      const rpm = 5;
      const key = await t.key(
        { rps, rpm, token_quota: { limit: BIG_QUOTA, period: "daily" } },
        "rate",
      );
      // Confirm the persisted shape (flat rps/rpm).
      const limits = await apiHelper.getApiKeyLimits(key.id);
      expect(limits.body?.rps).toBe(rps);
      expect(limits.body?.rpm).toBe(rpm);

      await waitGatewayReady(e, key.sk, { workspace: e.workspace });

      // Per-second: a single burst beyond rps trips at least (burst - rps)
      // rejections in one second.
      let sawRps = false;
      for (let i = 0; i < 8 && !sawRps; i++) {
        const results = await burst(e, key.sk, rps + 3, {
          workspace: e.workspace,
        });
        const rejects = results.filter(
          (r) =>
            r.status === 429 && errorCode(r.body) === "rate_limit_exceeded",
        );
        if (rejects.length >= 2) {
          expect(errorMessage(rejects[0].body)).toBe(
            "Request rate limit exceeded for this API key",
          );
          sawRps = true;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      expect(sawRps).toBe(true);

      // Per-minute: pace single requests ~1.2s apart (never tripping the RPS
      // window) until the minute budget is exhausted. Track successes since the
      // last window roll — a rate 429 only counts as the RPM limit when it lands
      // after at least `rpm` successes in the same fixed window (a 429 arriving
      // sooner just means the calendar-minute bucket rolled mid-count → reset).
      let sawRpm = false;
      let succ = 0;
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline && !sawRpm) {
        const r = await infer(e, key.sk, { workspace: e.workspace });
        if (r.status === 429 && errorCode(r.body) === "rate_limit_exceeded") {
          if (succ >= rpm) sawRpm = true;
          else succ = 0;
        } else if (r.status === 200) {
          succ++;
        }
        await new Promise((res) => setTimeout(res, 1200));
      }
      expect(sawRpm).toBe(true);
    } finally {
      await t.cleanup();
    }
  });

  test("in-flight concurrency over the max → 429 concurrency_exceeded", {
    tag: "@C2727095",
  }, async ({ apiHelper }) => {
    test.setTimeout(120_000);
    const t = tracker(apiHelper);
    try {
      const key = await t.key(
        { concurrency: 1, token_quota: { limit: BIG_QUOTA, period: "daily" } },
        "cc",
      );
      const limits = await apiHelper.getApiKeyLimits(key.id);
      expect(limits.body?.concurrency).toBe(1);
      await waitGatewayReady(e, key.sk, { workspace: e.workspace });

      let sawConcurrency = false;
      for (let attempt = 0; attempt < 6 && !sawConcurrency; attempt++) {
        // Hold one request in-flight (~3s) and fire a second during it.
        const inflight = infer(e, key.sk, {
          workspace: e.workspace,
          delayMs: 3000,
        });
        await new Promise((r) => setTimeout(r, 400));
        const second = await infer(e, key.sk, { workspace: e.workspace });
        const first = await inflight;
        if (
          second.status === 429 &&
          errorCode(second.body) === "concurrency_exceeded"
        ) {
          expect(errorMessage(second.body)).toBe(
            "Concurrency limit exceeded for this API key",
          );
          // The in-flight request itself was allowed.
          expect(first.status).toBe(200);
          sawConcurrency = true;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      expect(sawConcurrency).toBe(true);

      // After the in-flight request drains, a new one succeeds.
      const after = await infer(e, key.sk, { workspace: e.workspace });
      expect(after.status).toBe(200);
    } finally {
      await t.cleanup();
    }
  });

  test("model outside the allowlist → 403 model_not_permitted", {
    tag: "@C2727096",
  }, async ({ apiHelper }) => {
    test.setTimeout(120_000);
    const t = tracker(apiHelper);
    try {
      const allow = `aq-allow-${uid()}`;
      const deny = `aq-deny-${uid()}`;
      const ep = await t.twoModelEndpoint(allow, deny);
      const key = await t.key({ allowed_models: [allow] }, "wl");
      const limits = await apiHelper.getApiKeyLimits(key.id);
      expect(limits.body?.allowed_models).toEqual([allow]);

      // The allowed model succeeds…
      await waitGatewayReady(e, key.sk, {
        workspace: e.workspace,
        external: true,
        endpoint: ep,
        model: allow,
      });
      // …the disallowed model is rejected (poll past reconcile).
      const denied = await waitForReject(
        e,
        key.sk,
        { status: 403, code: "model_not_permitted" },
        { workspace: e.workspace, external: true, endpoint: ep, model: deny },
      );
      expect(errorMessage(denied.body)).toBe(
        "Model not permitted for this API key",
      );
    } finally {
      await t.cleanup();
    }
  });

  test("empty allowlist denies every model → 403 model_not_permitted", {
    tag: "@C2727097",
  }, async ({ apiHelper }) => {
    test.setTimeout(90_000);
    const t = tracker(apiHelper);
    try {
      const key = await t.key({ allowed_models: [] }, "denyall");
      const limits = await apiHelper.getApiKeyLimits(key.id);
      expect(limits.body?.allowed_models).toEqual([]);

      const denied = await waitForReject(
        e,
        key.sk,
        { status: 403, code: "model_not_permitted" },
        { workspace: e.workspace },
      );
      expect(errorMessage(denied.body)).toBe(
        "Model not permitted for this API key",
      );
    } finally {
      await t.cleanup();
    }
  });

  test("disabled key → 403 key_disabled", {
    tag: "@C2727098",
  }, async ({ apiHelper }) => {
    test.setTimeout(90_000);
    const t = tracker(apiHelper);
    try {
      const key = await t.key({ disabled: true }, "disabled");
      const limits = await apiHelper.getApiKeyLimits(key.id);
      expect(limits.body?.disabled).toBe(true);

      const denied = await waitForReject(
        e,
        key.sk,
        { status: 403, code: "key_disabled" },
        { workspace: e.workspace },
      );
      expect(errorMessage(denied.body)).toBe("This API key is disabled");
    } finally {
      await t.cleanup();
    }
  });

  test("access denial precedes quota denial", {
    tag: "@C2727099",
  }, async ({ apiHelper }) => {
    test.setTimeout(240_000);
    const t = tracker(apiHelper);
    try {
      // Key A: disabled AND quota exhausted → 403 key_disabled wins over 429.
      const keyA = await t.key(
        { token_quota: { limit: 120, period: "daily" } },
        "seq-dis",
      );
      await waitGatewayReady(e, keyA.sk, {
        workspace: e.workspace,
        completionTokens: 40,
        promptTokens: 10,
      });
      await exhaustQuota(apiHelper, e, keyA.sk, {
        workspace: e.workspace,
        completionTokens: 40,
        promptTokens: 10,
      });
      // Now disable it (preserving the exhausted quota).
      const setA = await apiHelper.setApiKeyLimits(keyA.id, {
        token_quota: { limit: 120, period: "daily" },
        disabled: true,
      });
      expect(setA.status).toBe(200);
      const denA = await waitForReject(
        e,
        keyA.sk,
        { status: 403, code: "key_disabled" },
        { workspace: e.workspace, completionTokens: 40, promptTokens: 10 },
      );
      expect(denA.status).toBe(403);

      // Key B: allowlist {allow} AND quota exhausted. Disallowed model → 403
      // model_not_permitted; allowed model → 429 quota_exceeded.
      const allow = `aq-allow-${uid()}`;
      const deny = `aq-deny-${uid()}`;
      const ep = await t.twoModelEndpoint(allow, deny);
      const keyB = await t.key(
        {
          allowed_models: [allow],
          token_quota: { limit: 120, period: "daily" },
        },
        "seq-wl",
      );
      await waitGatewayReady(e, keyB.sk, {
        workspace: e.workspace,
        external: true,
        endpoint: ep,
        model: allow,
        completionTokens: 40,
        promptTokens: 10,
      });
      await exhaustQuota(apiHelper, e, keyB.sk, {
        workspace: e.workspace,
        external: true,
        endpoint: ep,
        model: allow,
        completionTokens: 40,
        promptTokens: 10,
      });
      // Disallowed model → access 403 despite the exhausted quota.
      const denyModel = await waitForReject(
        e,
        keyB.sk,
        { status: 403, code: "model_not_permitted" },
        { workspace: e.workspace, external: true, endpoint: ep, model: deny },
      );
      expect(denyModel.status).toBe(403);
      // Allowed model → quota 429.
      const quota = await infer(e, keyB.sk, {
        workspace: e.workspace,
        external: true,
        endpoint: ep,
        model: allow,
        completionTokens: 40,
        promptTokens: 10,
      });
      expect(quota.status).toBe(429);
      expect(errorCode(quota.body)).toBe("quota_exceeded");
    } finally {
      await t.cleanup();
    }
  });

  test("lowering RPS takes effect after reconcile", {
    tag: "@C2727100",
  }, async ({ apiHelper }) => {
    test.setTimeout(150_000);
    const t = tracker(apiHelper);
    try {
      const key = await t.key(
        { rps: 20, token_quota: { limit: BIG_QUOTA, period: "daily" } },
        "reconf",
      );
      await waitGatewayReady(e, key.sk, { workspace: e.workspace });

      // Lower RPS to 2 and wait until the reconciled plugin enforces it.
      const set = await apiHelper.setApiKeyLimits(key.id, {
        rps: 2,
        token_quota: { limit: BIG_QUOTA, period: "daily" },
      });
      expect(set.status).toBe(200);
      const reread = await apiHelper.getApiKeyLimits(key.id);
      expect(reread.body?.rps).toBe(2);

      let enforced = false;
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline && !enforced) {
        const results = await burst(e, key.sk, 5, { workspace: e.workspace });
        const rejects = results.filter(
          (r) =>
            r.status === 429 && errorCode(r.body) === "rate_limit_exceeded",
        );
        if (rejects.length >= 2) enforced = true;
        else await new Promise((r) => setTimeout(r, 2000));
      }
      expect(enforced).toBe(true);

      // The second window resets → a single request succeeds again.
      await new Promise((r) => setTimeout(r, 2200));
      const after = await infer(e, key.sk, { workspace: e.workspace });
      expect(after.status).toBe(200);
    } finally {
      await t.cleanup();
    }
  });

  test("deleting the rate-limit rule restores burst success", {
    tag: "@C2727103",
  }, async ({ apiHelper }) => {
    test.setTimeout(150_000);
    const t = tracker(apiHelper);
    try {
      const rps = 2;
      const key = await t.key(
        { rps, token_quota: { limit: BIG_QUOTA, period: "daily" } },
        "delrate",
      );
      await waitGatewayReady(e, key.sk, { workspace: e.workspace });

      // Baseline: a burst beyond rps is rate-limited (rule is enforced).
      let enforced = false;
      for (let i = 0; i < 8 && !enforced; i++) {
        const results = await burst(e, key.sk, rps + 2, {
          workspace: e.workspace,
        });
        const rejects = results.filter(
          (r) =>
            r.status === 429 && errorCode(r.body) === "rate_limit_exceeded",
        );
        if (rejects.length >= 1) enforced = true;
        else await new Promise((r) => setTimeout(r, 1500));
      }
      expect(enforced).toBe(true);

      // Remove the rate rule (whole-object replace omitting rps).
      const set = await apiHelper.setApiKeyLimits(key.id, {
        token_quota: { limit: BIG_QUOTA, period: "daily" },
      });
      expect(set.status).toBe(200);
      const reread = await apiHelper.getApiKeyLimits(key.id);
      expect(reread.body?.rps).toBeUndefined();

      // After reconcile, a burst of rps+2 no longer produces rate rejections.
      // Require two consecutive clean bursts so we don't accept a lucky window.
      let cleanStreak = 0;
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline && cleanStreak < 2) {
        await new Promise((r) => setTimeout(r, 2500));
        const results = await burst(e, key.sk, rps + 2, {
          workspace: e.workspace,
        });
        const rejects = results.filter(
          (r) =>
            r.status === 429 && errorCode(r.body) === "rate_limit_exceeded",
        );
        cleanStreak = rejects.length === 0 ? cleanStreak + 1 : 0;
      }
      expect(cleanStreak).toBeGreaterThanOrEqual(2);
    } finally {
      await t.cleanup();
    }
  });
});
