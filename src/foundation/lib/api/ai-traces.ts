import { clientPostgrest, REST_URL } from "@/foundation/lib/api";

export type AITrace = {
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

type AITraceListParams = {
  workspace: string;
  endpoint_name?: string;
  endpoint_type?: string;
  status?: string;
  model?: string;
  api_key_id?: string;
  finish_reason?: string;
  limit?: number;
  start?: string;
  end?: string;
  before?: string;
};

async function apiGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = {};
  const auth = clientPostgrest.headers.Authorization;
  if (typeof auth === "string" && auth) {
    headers.Authorization = auth;
  }

  const res = await fetch(url, { headers, signal });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error ?? "";
    } catch {
      // ignore JSON parse error
    }
    throw new Error(
      `ai-traces request failed: ${res.status} ${detail || res.statusText}`,
    );
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
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined && v !== "") {
      search.set(k, String(v));
    }
  }

  const url = `${REST_URL}/ai-traces/${encodeURIComponent(workspace)}?${search.toString()}`;
  return apiGet<AITraceListResponse>(url, signal);
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

// fetchAITraceStats returns per-day request counts for the activity chart.
export async function fetchAITraceStats(
  workspace: string,
  days?: number,
  signal?: AbortSignal,
): Promise<AITraceStatsResponse> {
  const qs = days != null ? `?days=${days}` : "";
  const url = `${REST_URL}/ai-traces/${encodeURIComponent(workspace)}/stats${qs}`;
  return apiGet<AITraceStatsResponse>(url, signal);
}
