import type { Browser } from "@playwright/test";
import { ApiHelper } from "./api-helper";
import {
  chatCompletion,
  type GatewayResult,
  type UsageEnv,
} from "./model-usage";
import { loginAs } from "./test-user-context";

/**
 * Helpers for the API-key limits (quota / rate / access control) e2e tests.
 *
 * Limits are carried on `api_key.spec.limits` and enforced at the AI gateway by
 * two Kong plugins reconciled onto the key's consumer by the control plane:
 *   - `neutree-ai-access` (priority 895): disabled → 403 key_disabled;
 *     allowed-models → 403 model_not_permitted; concurrency → 429
 *     concurrency_exceeded; rps/rpm → 429 rate_limit_exceeded.
 *   - `neutree-ai-quota` (priority 890): token quota → 429 quota_exceeded.
 * Access (895) runs before quota (890), so a 403 access denial precedes a 429
 * quota denial.
 *
 * Two kinds of eventual consistency matter:
 *   - After creating/editing a key the control plane must reconcile the plugin
 *     config onto the Kong consumer (poll until enforcement is observable).
 *   - Token-quota enforcement is derived from the aggregated usage ledger and
 *     cached in the plugin for a few seconds, so exhausting a quota means
 *     inferring + forcing aggregation until `get_api_key_remaining` ≤ 0 and the
 *     plugin cache turns over.
 */

/** The error code the gateway returns when it rejects a request. */
export type GatewayErrorCode =
  | "key_disabled"
  | "model_not_permitted"
  | "concurrency_exceeded"
  | "rate_limit_exceeded"
  | "quota_exceeded";

/** Pull the machine-readable error code out of a gateway rejection body. */
export function errorCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  const err = b.error as Record<string, unknown> | undefined;
  return (err?.code ?? b.code) as string | undefined;
}

/** Pull the human-readable message out of a gateway rejection body. */
export function errorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  const err = b.error as Record<string, unknown> | undefined;
  return (err?.message ?? b.message) as string | undefined;
}

export interface InferOpts {
  model?: string;
  endpoint?: string;
  external?: boolean;
  workspace?: string;
  /** Deterministic token spend (prompt + completion). Default 3 + 5 = 8. */
  promptTokens?: number;
  completionTokens?: number;
  /** Keep the request in-flight this long (engine honors `delay_ms`). */
  delayMs?: number;
}

/** Fire one non-streaming inference through the gateway (no 401 retry). */
export async function infer(
  env: UsageEnv,
  apiKey: string,
  opts?: InferOpts,
): Promise<GatewayResult> {
  return chatCompletion(
    env,
    apiKey,
    {
      mode: "fixed",
      text: "access quota",
      prompt_tokens: opts?.promptTokens ?? 3,
      completion_tokens: opts?.completionTokens ?? 5,
      finish_reason: "stop",
      ...(opts?.delayMs ? { delay_ms: opts.delayMs } : {}),
    },
    {
      model: opts?.model,
      endpoint: opts?.endpoint,
      external: opts?.external,
      workspace: opts?.workspace,
      retryOn401: false,
    },
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A test user with its own logged-in ApiHelper and a disposable identity. */
export interface TestUser {
  uid: string;
  email: string;
  /** ApiHelper bound to this user's authenticated page. */
  api: ApiHelper;
  page: import("@playwright/test").Page;
  cleanup: () => Promise<void>;
}

/**
 * Create a fresh user (role + global policy), log it in a new browser context,
 * and return an ApiHelper bound to its session. Cleanup closes the context and
 * soft-deletes the identity. Keys created through `user.api` are owned by this
 * user (create_api_key keys on auth.uid()).
 */
export async function makeUser(
  admin: ApiHelper,
  browser: Browser,
  perms: string[] = [
    "workspace:read",
    "workspace:usage-read",
    "endpoint:read",
    "external_endpoint:read",
  ],
): Promise<TestUser> {
  const ts = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email = `aq-${ts}@e2e.local`;
  const uname = `aq-${ts}`;
  const role = `aq-r-${ts}`;
  const policy = `aq-p-${ts}`;
  const uid = await admin.createUser(uname, email, "Test@123456");
  await admin.createRole(role, perms);
  await admin.createPolicy(policy, uid, role, true);
  const { page, context } = await loginAs(browser, admin, email, "Test@123456");
  const api = new ApiHelper(page);
  return {
    uid,
    email,
    api,
    page,
    cleanup: async () => {
      await context.close();
      await admin.deletePolicy(policy).catch(() => {});
      await admin.deleteRole(role, { retries: 10 }).catch(() => {});
      await admin.deleteUser(uname, { retries: 10 }).catch(() => {});
    },
  };
}

/**
 * Poll the gateway until a freshly created/edited key can successfully infer —
 * its consumer + ACL groups are synced (past 401/403) and any freshly created
 * endpoint route is provisioned (past 404). Returns once a 200 is seen.
 */
export async function waitGatewayReady(
  env: UsageEnv,
  apiKey: string,
  opts?: InferOpts & { timeoutMs?: number },
): Promise<void> {
  const deadline = Date.now() + (opts?.timeoutMs ?? 120_000);
  while (Date.now() < deadline) {
    const r = await infer(env, apiKey, opts);
    if (r.status === 200) return;
    if (![401, 403, 404, 503].includes(r.status)) {
      throw new Error(
        `waitGatewayReady: unexpected ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`,
      );
    }
    await sleep(4000);
  }
  throw new Error("waitGatewayReady: key never became ready");
}

/**
 * Poll `infer` until it returns the expected reject status + error code (the
 * control plane may still be reconciling the plugin, so an early call can slip
 * through with 200). Returns the matching result.
 */
export async function waitForReject(
  env: UsageEnv,
  apiKey: string,
  expect: { status: number; code: GatewayErrorCode },
  opts?: InferOpts & { timeoutMs?: number; intervalMs?: number },
): Promise<GatewayResult> {
  const deadline = Date.now() + (opts?.timeoutMs ?? 90_000);
  let last: GatewayResult | undefined;
  while (Date.now() < deadline) {
    last = await infer(env, apiKey, opts);
    if (last.status === expect.status && errorCode(last.body) === expect.code) {
      return last;
    }
    await sleep(opts?.intervalMs ?? 3000);
  }
  throw new Error(
    `waitForReject: never saw ${expect.status}/${expect.code}; last ${last?.status} ${JSON.stringify(last?.body).slice(0, 200)}`,
  );
}

/**
 * Fire `n` inferences concurrently (a burst) and return each result. Used to
 * trip per-second rate limits and concurrency limits.
 */
export async function burst(
  env: UsageEnv,
  apiKey: string,
  n: number,
  opts?: InferOpts,
): Promise<GatewayResult[]> {
  return Promise.all(Array.from({ length: n }, () => infer(env, apiKey, opts)));
}

/**
 * Drive one inference on a key and wait until its aggregated current-period
 * usage is positive (forcing aggregation each round). Returns the used tokens.
 * Used to light up the list/detail usage displays deterministically.
 */
export async function produceKeyUsage(
  api: ApiHelper,
  env: UsageEnv,
  apiKey: string,
  keyId: string,
  opts?: InferOpts & { period?: string; timeoutMs?: number },
): Promise<number> {
  const tokens = {
    completionTokens: opts?.completionTokens ?? 40,
    promptTokens: opts?.promptTokens ?? 10,
  };
  await waitGatewayReady(env, apiKey, { ...opts, ...tokens });
  await infer(env, apiKey, { ...opts, ...tokens });
  const period = opts?.period ?? "daily";
  const deadline = Date.now() + (opts?.timeoutMs ?? 90_000);
  let used = 0;
  while (Date.now() < deadline && used <= 0) {
    await api.aggregateUsage();
    const p = await api.apiKeyPeriodUsage(keyId, period);
    used = Number(p.body ?? 0);
    if (used <= 0) await sleep(4000);
  }
  if (used <= 0) throw new Error("produceKeyUsage: usage never surfaced");
  return used;
}

/**
 * Exhaust a key's token quota: repeatedly infer (spending tokens), force the
 * usage aggregation, and wait for the plugin cache to turn over, until an
 * inference is rejected with 429 quota_exceeded. Returns the rejecting result.
 */
export async function exhaustQuota(
  api: ApiHelper,
  env: UsageEnv,
  apiKey: string,
  opts?: InferOpts & { timeoutMs?: number; cacheTtlMs?: number },
): Promise<GatewayResult> {
  const deadline = Date.now() + (opts?.timeoutMs ?? 180_000);
  let last: GatewayResult | undefined;
  while (Date.now() < deadline) {
    last = await infer(env, apiKey, opts);
    if (last.status === 429 && errorCode(last.body) === "quota_exceeded") {
      return last;
    }
    await api.aggregateUsage();
    // Let the quota plugin's short-lived remaining cache expire so it re-reads
    // the freshly aggregated ledger.
    await sleep(opts?.cacheTtlMs ?? 6000);
  }
  throw new Error(
    `exhaustQuota: never hit 429 quota_exceeded; last ${last?.status} ${JSON.stringify(last?.body).slice(0, 200)}`,
  );
}
