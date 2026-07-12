import type { ApiHelper } from "./api-helper";

/**
 * Helpers for the Access Log (ai-traces) trace-dependent e2e tests.
 *
 * Real traces are produced by driving a controlled request through the AI
 * gateway to a deployed `e2e` engine endpoint (see neutree-e2e-engine): the
 * request flows Kong -> vector -> VictoriaLogs and surfaces via the
 * `/api/v1/ai-traces` read API and the Access Log UI. The engine output is
 * fully programmable via an inline `e2e:{...}` directive in the user message,
 * so token counts, finish_reason, and body content are deterministic.
 *
 * Gating (opt-in, like the GPU recipe spec):
 *  - E2E_AITRACE_ENDPOINT  — name of a Running e2e-engine endpoint (default workspace)
 *  - E2E_AITRACE_GATEWAY   — AI gateway base URL (default: BASE_URL host on :80)
 */

export interface AiTraceEnv {
  endpoint: string;
  gateway: string;
  workspace: string;
  /** Served model name to send as the OpenAI `model` field (env-specific). */
  model?: string;
}

/** Resolve gating config from env, or null when the suite should be skipped. */
export function aiTraceEnv(): AiTraceEnv | null {
  const endpoint = process.env.E2E_AITRACE_ENDPOINT;
  if (!endpoint) return null;
  return {
    endpoint,
    gateway: gatewayBase(),
    workspace: process.env.E2E_AITRACE_WORKSPACE ?? "default",
    model: process.env.E2E_AITRACE_MODEL,
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

/** Build an inline directive string understood by the e2e engine. */
export function directive(d: Record<string, unknown>): string {
  return `e2e:${JSON.stringify(d)}`;
}

export interface GatewayResult {
  status: number;
  body: unknown;
  /** OpenAI request id echoed by the gateway (x-request-id header), if present. */
  requestId: string | null;
}

/**
 * Fire a (non-streaming) chat completion through the AI gateway using an API
 * key. Runs in Node (not the browser) — the gateway is a different origin and
 * uses bearer API-key auth, so CORS/session don't apply.
 */
export async function chatCompletion(
  env: AiTraceEnv,
  apiKey: string,
  d: Record<string, unknown>,
  opts?: {
    stream?: boolean;
    model?: string;
    endpoint?: string;
    /** Route through an external endpoint (model gateway) instead of internal. */
    external?: boolean;
    /** Retry while the gateway returns 401 (Kong syncs new API keys async). */
    retryOn401?: boolean;
  },
): Promise<GatewayResult> {
  const endpoint = opts?.endpoint ?? env.endpoint;
  const kind = opts?.external ? "external-endpoint" : "endpoint";
  const url = `${env.gateway}/workspace/${env.workspace}/${kind}/${endpoint}/v1/chat/completions`;
  const payload = JSON.stringify({
    model: opts?.model ?? env.model ?? "any",
    stream: opts?.stream ?? false,
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
  return { status: r.status, body, requestId: r.headers.get("x-request-id") };
}

/**
 * Poll the ai-traces list for `workspace` until `match` returns true for some
 * item, then return that item. New traces are ingested asynchronously
 * (Kong -> vector -> VictoriaLogs), so callers must poll rather than read once.
 */
export async function waitForTrace(
  api: ApiHelper,
  workspace: string,
  match: (item: Record<string, unknown>) => boolean,
  opts?: {
    timeoutMs?: number;
    intervalMs?: number;
    query?: Record<string, string | number>;
  },
): Promise<Record<string, unknown>> {
  const timeoutMs = opts?.timeoutMs ?? 120_000;
  const intervalMs = opts?.intervalMs ?? 4_000;
  const start = Date.now();
  let lastCount = -1;
  while (Date.now() - start < timeoutMs) {
    const r = await api.listAITraces<{ items: Array<Record<string, unknown>> }>(
      workspace,
      { limit: 50, ...opts?.query },
    );
    if (r.ok && Array.isArray(r.body?.items)) {
      lastCount = r.body.items.length;
      const hit = r.body.items.find(match);
      if (hit) return hit;
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error(
    `waitForTrace: no matching trace in ${workspace} after ${timeoutMs}ms (last item count: ${lastCount})`,
  );
}
