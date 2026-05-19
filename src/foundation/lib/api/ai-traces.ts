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
  request_body?: string;
  response_body?: string;
};

type AITraceListResponse = {
  items: AITrace[];
  next_before?: string;
};

type AITraceListParams = {
  workspace: string;
  endpoint_name?: string;
  endpoint_type?: string;
  status?: string;
  model?: string;
  limit?: number;
  start?: string;
  before?: string;
};

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

  return (await res.json()) as AITraceListResponse;
}
