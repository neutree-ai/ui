import type { ApiHelper, UsageRow } from "./api-helper";

/**
 * Helpers for the Model Usage (get_usage_by_dimension) e2e tests.
 *
 * Real usage rows are produced by driving a controlled request through the AI
 * gateway to a deployed programmable engine endpoint (see neutree-e2e-engine):
 * the request is logged as an ai-trace, Vector POSTs it to `record_api_usage`
 * (raw row), and the 5-minute aggregation cron rolls it up into
 * `api.api_daily_usage`, which the `get_usage_by_dimension` RPC reads. Tests
 * force the aggregation immediately (via `ApiHelper.aggregateUsage`) instead of
 * waiting for the cron.
 *
 * The engine output is fully programmable via an inline `e2e:{...}` directive
 * in the user message, so token counts and the reported `model` are
 * deterministic — `model` in the request becomes the row's `model_name`.
 *
 * Gating (opt-in, shared with the ai-traces recipe):
 *  - E2E_AITRACE_ENDPOINT  — name of a Running e2e-engine endpoint (default workspace)
 *  - E2E_AITRACE_GATEWAY   — AI gateway base URL (default: BASE_URL host on :80)
 */

export interface UsageEnv {
  endpoint: string;
  gateway: string;
  workspace: string;
}

/** Resolve gating config from env, or null when the suite should be skipped. */
export function usageEnv(): UsageEnv | null {
  const endpoint = process.env.E2E_AITRACE_ENDPOINT;
  if (!endpoint) return null;
  return {
    endpoint,
    gateway: gatewayBase(),
    workspace: process.env.E2E_AITRACE_WORKSPACE ?? "default",
  };
}

/** AI gateway base URL: explicit env, else BASE_URL host on port 80. */
export function gatewayBase(): string {
  if (process.env.E2E_AITRACE_GATEWAY) return process.env.E2E_AITRACE_GATEWAY;
  const base = process.env.BASE_URL ?? "http://localhost:3000";
  const u = new URL(base);
  u.port = process.env.E2E_AITRACE_GATEWAY_PORT ?? "80";
  u.pathname = "";
  return u.toString().replace(/\/$/, "");
}

/** The engine host (gateway host without the port), for external-endpoint upstreams. */
export function engineHost(env: UsageEnv): string {
  return env.gateway.replace(/:\d+$/, "");
}

/** Build an inline directive string understood by the e2e engine. */
export function directive(d: Record<string, unknown>): string {
  return `e2e:${JSON.stringify(d)}`;
}

/** Local date (YYYY-MM-DD) offset by `days` from today. */
export function isoDate(daysFromToday = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface GatewayResult {
  status: number;
  body: unknown;
}

/**
 * Fire a (non-streaming) chat completion through the AI gateway using an API
 * key. Runs in Node — the gateway is a different origin and uses bearer
 * API-key auth, so CORS/session don't apply. Retries while the gateway returns
 * 401 (Kong syncs new API keys asynchronously).
 */
export async function chatCompletion(
  env: UsageEnv,
  apiKey: string,
  d: Record<string, unknown>,
  opts?: {
    model?: string;
    endpoint?: string;
    external?: boolean;
    workspace?: string;
    retryOn401?: boolean;
  },
): Promise<GatewayResult> {
  const endpoint = opts?.endpoint ?? env.endpoint;
  const workspace = opts?.workspace ?? env.workspace;
  const kind = opts?.external ? "external-endpoint" : "endpoint";
  const url = `${env.gateway}/workspace/${workspace}/${kind}/${endpoint}/v1/chat/completions`;
  const payload = JSON.stringify({
    model: opts?.model ?? "any",
    stream: false,
    messages: [{ role: "user", content: directive(d) }],
  });
  const attempts = opts?.retryOn401 === false ? 1 : 25;
  let res: Response | undefined;
  for (let i = 0; i < attempts; i++) {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: payload,
    });
    if (res.status !== 401) break;
    await new Promise((r) => setTimeout(r, 4000));
  }
  const r = res as Response;
  const text = await r.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {}
  return { status: r.status, body };
}

/**
 * Produce a deterministic usage record: fire one gateway inference with a known
 * `completion_tokens`/`prompt_tokens`/`model`, then poll the RPC (forcing
 * aggregation each round) until a matching row appears. Returns the matching row.
 */
export async function produceUsage(
  api: ApiHelper,
  env: UsageEnv,
  apiKey: string,
  opts: {
    model?: string;
    promptTokens?: number;
    completionTokens: number;
    external?: boolean;
    endpoint?: string;
    /** Workspace of the endpoint/route and of the usage query (default env.workspace). */
    workspace?: string;
    /** Match predicate on the resulting RPC row (default: matches the token totals + model). */
    match?: (row: UsageRow) => boolean;
    timeoutMs?: number;
  },
): Promise<UsageRow> {
  const workspace = opts.workspace ?? env.workspace;
  const model = opts.model ?? "any";
  const prompt = opts.promptTokens ?? 3;
  // Retry the gateway call until it succeeds: a freshly created key needs its
  // Kong consumer/ACL groups synced (401/403) and a freshly created external
  // endpoint needs its route provisioned (404) — both settle asynchronously.
  const readyDeadline = Date.now() + (opts.timeoutMs ?? 120_000);
  let gw: GatewayResult | undefined;
  while (Date.now() < readyDeadline) {
    gw = await chatCompletion(
      env,
      apiKey,
      {
        mode: "fixed",
        text: "model usage",
        prompt_tokens: prompt,
        completion_tokens: opts.completionTokens,
        finish_reason: "stop",
      },
      {
        model,
        external: opts.external,
        endpoint: opts.endpoint,
        workspace,
      },
    );
    if (gw.status === 200) break;
    if (![401, 403, 404, 503].includes(gw.status)) break;
    await new Promise((r) => setTimeout(r, 4000));
  }
  if (gw?.status !== 200) {
    throw new Error(
      `gateway inference failed: ${gw?.status} ${JSON.stringify(gw?.body).slice(0, 300)}`,
    );
  }
  const total = prompt + opts.completionTokens;
  const match =
    opts.match ??
    ((row: UsageRow) =>
      row.usage === total &&
      (model === "any" || row.model_name === model) &&
      (opts.external
        ? row.endpoint_type === "external-endpoint"
        : row.endpoint_type === "endpoint"));
  return waitForUsage(api, match, {
    start: isoDate(-1),
    end: isoDate(0),
    workspace,
    timeoutMs: opts.timeoutMs,
  });
}

/**
 * Poll `get_usage_by_dimension` (forcing aggregation each round) until `match`
 * returns true for some row, then return that row.
 */
export async function waitForUsage(
  api: ApiHelper,
  match: (row: UsageRow) => boolean,
  opts: {
    start: string;
    end: string;
    workspace?: string;
    apiKeyId?: string;
    timeoutMs?: number;
    intervalMs?: number;
  },
): Promise<UsageRow> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const intervalMs = opts.intervalMs ?? 4_000;
  const start = Date.now();
  let last = 0;
  while (Date.now() - start < timeoutMs) {
    await api.aggregateUsage();
    const r = await api.getUsageByDimension({
      start: opts.start,
      end: opts.end,
      workspace: opts.workspace,
      apiKeyId: opts.apiKeyId,
    });
    if (r.ok && Array.isArray(r.body)) {
      last = r.body.length;
      const hit = r.body.find(match);
      if (hit) return hit;
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error(
    `waitForUsage: no matching usage row after ${timeoutMs}ms (last row count: ${last})`,
  );
}
