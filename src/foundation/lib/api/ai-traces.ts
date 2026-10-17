import { clientPostgrest, REST_URL } from "@/foundation/lib/api";

export type AITrace = {
  upstream?: string;
  upstream_model?: string;
  request_id: string;
  time: string;
  workspace: string;
  endpoint_type: string;
  endpoint_name: string;
  api_key_id?: string;
  request_uri?: string;
  request_model?: string;
  response_model?: string;
  response_status: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  finish_reason?: string;
  stream?: boolean;
  user_agent?: string;
  duration_ms?: number;
  request_body?: string;
  response_body?: string;
};

type AITraceListResponse = {
  items: AITrace[];
  next_before?: string;
};

export type AITraceDayCount = {
  date: string;
  count: number;
};

type AITraceStatsResponse = {
  days: AITraceDayCount[];
};

// The filter, time-window and scope a trace query is made of. The list and the
// export send exactly these, so an export holds what the list shows.
export type AITraceFilterParams = {
  request_id?: string;
  request_model?: string;
  upstream?: string;
  upstream_model?: string;
  workspace: string;
  endpoint_name?: string;
  endpoint_type?: string;
  status?: string;
  model?: string;
  api_key_id?: string;
  finish_reason?: string;
  start?: string;
  end?: string;
};

type AITraceListParams = AITraceFilterParams & {
  limit?: number;
  before?: string;
};

export type AITraceExportFormat = "csv" | "jsonl";

export class AITraceRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AITraceRequestError";
  }
}

// 403: the caller may not read traces in this workspace — a standing fact
// about the user to explain, not a failure to report.
export const isAITraceForbidden = (error: unknown): boolean =>
  error instanceof AITraceRequestError && error.status === 403;

function authHeaders(): Record<string, string> {
  const auth = clientPostgrest.headers.Authorization;
  return typeof auth === "string" && auth ? { Authorization: auth } : {};
}

async function requestError(res: Response): Promise<AITraceRequestError> {
  let detail = "";
  try {
    const body = await res.json();
    detail = body?.error ?? "";
  } catch {
    // ignore JSON parse error
  }
  return new AITraceRequestError(
    res.status,
    `ai-traces request failed: ${res.status} ${detail || res.statusText}`,
  );
}

async function apiGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { headers: authHeaders(), signal });
  if (!res.ok) {
    throw await requestError(res);
  }

  return (await res.json()) as T;
}

// fetchAITraces lists trace records (metadata only — no request/response
// bodies, which the list view does not render).
export async function fetchAITraces(
  params: AITraceListParams,
  signal?: AbortSignal,
): Promise<AITraceListResponse> {
  const { workspace, ...rest } = params;
  const url = `${REST_URL}/ai-traces/${encodeURIComponent(workspace)}?${toSearch(rest)}`;
  return apiGet<AITraceListResponse>(url, signal);
}

// toSearch encodes the set parameters, leaving out unset and empty ones.
function toSearch(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") {
      search.set(k, String(v));
    }
  }
  return search.toString();
}

export type AITraceEndpointOption = {
  name: string;
  type: string;
};

export type AITraceFilterOptions = {
  endpoints: AITraceEndpointOption[];
  endpoints_truncated: boolean;
  models: string[];
  models_truncated: boolean;
};

type AITraceFilterOptionsParams = {
  workspace: string;
  start?: string;
  end?: string;
  endpoint_type?: string;
};

// fetchAITraceFilterOptions lists the endpoint and model names found in the
// traces of a window, for the list's name filters. Each list is capped, and
// `*_truncated` says the cap was hit.
export async function fetchAITraceFilterOptions(
  params: AITraceFilterOptionsParams,
  signal?: AbortSignal,
): Promise<AITraceFilterOptions> {
  const { workspace, ...rest } = params;
  const url = `${REST_URL}/ai-traces/${encodeURIComponent(workspace)}/filter-options?${toSearch(rest)}`;
  return apiGet<AITraceFilterOptions>(url, signal);
}

// filenameFromDisposition reads the file name from a Content-Disposition
// header, preferring the RFC 5987 `filename*` form.
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const extended = header.match(/filename\*\s*=\s*(?:[\w-]+)?''([^;]+)/i);
  if (extended?.[1]) {
    try {
      return decodeURIComponent(extended[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // fall through to the plain form
    }
  }
  const plain = header.match(
    /filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i,
  );
  const name = (plain?.[1] ?? plain?.[2])?.trim();
  return name || null;
}

// exportAITraces downloads the traces matching `params` as one file (metadata
// only, server-capped at 100,000 rows).
export async function exportAITraces(
  params: AITraceFilterParams,
  format: AITraceExportFormat,
  signal?: AbortSignal,
): Promise<{ blob: Blob; filename: string }> {
  const { workspace, ...rest } = params;
  const qs = toSearch({ ...rest, format });
  const url = `${REST_URL}/ai-traces/${encodeURIComponent(workspace)}/export?${qs}`;
  const res = await fetch(url, { headers: authHeaders(), signal });
  if (!res.ok) {
    throw await requestError(res);
  }

  const filename =
    filenameFromDisposition(res.headers.get("Content-Disposition")) ??
    `access-log-${workspace}-${new Date().toISOString().slice(0, 10)}.${format}`;
  return { blob: await res.blob(), filename };
}

// fetchAITrace loads a single trace including the full request/response
// bodies — used by the detail drawer so the list stays lightweight.
export async function fetchAITrace(
  workspace: string,
  requestId: string,
  signal?: AbortSignal,
): Promise<AITrace> {
  const url = `${REST_URL}/ai-traces/${encodeURIComponent(workspace)}/${encodeURIComponent(requestId)}`;
  return apiGet<AITrace>(url, signal);
}

// One API key's aggregated traffic over the requested window (backend computes
// requests / tokens / success / avg latency; success_rate is derived here).
type AITraceKeyStat = {
  api_key_id: string;
  requests: number;
  tokens: number;
  success: number;
  avg_duration_ms: number;
};

type AITraceKeyStatsResponse = {
  window_hours: number;
  keys: AITraceKeyStat[];
};

// fetchAITraceKeyStats returns per-API-key request/token/success/latency
// aggregates over a trailing window (default 24h) — powers the API-key list
// ranking overview and the detail "request performance" card.
export async function fetchAITraceKeyStats(
  workspace: string,
  windowHours?: number,
  signal?: AbortSignal,
): Promise<AITraceKeyStatsResponse> {
  const qs = windowHours != null ? `?window_hours=${windowHours}` : "";
  const url = `${REST_URL}/ai-traces/${encodeURIComponent(workspace)}/key-stats${qs}`;
  return apiGet<AITraceKeyStatsResponse>(url, signal);
}

// fetchAITraceStats returns per-day request counts for the activity chart.
// An explicit [start, end] window (RFC3339) makes the chart follow the list's
// date-range filter; `days` is the trailing-window fallback. The backend clamps
// the span to 90 day buckets.
export async function fetchAITraceStats(
  workspace: string,
  opts?: { start?: string; end?: string; days?: number },
  signal?: AbortSignal,
): Promise<AITraceStatsResponse> {
  const params = new URLSearchParams();
  if (opts?.start) params.set("start", opts.start);
  if (opts?.end) params.set("end", opts.end);
  if (opts?.days != null) params.set("days", String(opts.days));
  const qs = params.toString() ? `?${params.toString()}` : "";
  const url = `${REST_URL}/ai-traces/${encodeURIComponent(workspace)}/stats${qs}`;
  return apiGet<AITraceStatsResponse>(url, signal);
}
