import type { Metadata } from "@/foundation/types/basic-types";

// The limits object stored at api_key.spec.limits. get_api_key_limits also
// returns token_quota.used / token_quota.remaining (read-only, computed).
export type ApiKeyLimits = {
  token_quota?: {
    limit?: number;
    period?: string;
    used?: number;
    remaining?: number;
  };
  rps?: number;
  rpm?: number;
  concurrency?: number;
  allowed_models?: string[];
  disabled?: boolean;
};

export type ApiKey = {
  id: string;
  api_version: "v1";
  kind: "ApiKey";
  metadata: Metadata;
  spec: ApiKeySpec;
  status: ApiKeyStatus | null;
  project_id: string;
  description: string | null;
};

export type Project = {
  id: string;
  workspace: string;
  name: string;
  description: string | null;
  status: "enabled" | "disabled";
  is_default?: boolean;
};

// Project row enriched by the batched api.group_projects RPC (or computed
// client-side in the all-workspaces view): API key count and the sum of each
// key's current-cycle usage/limit.
export type ProjectGroup = Project & {
  api_key_count?: number;
  usage_used?: number;
  usage_limit?: number;
};

export type ApiKeySpec = {
  quota: number;
  // Quota + access limits for the key. Optional: keys with no limits have none.
  limits?: ApiKeyLimits | null;
};

export type ApiKeyStatus = {
  phase: ApiKeyPhase | null;
  last_transition_time: string | null;
  error_message: string | null;
  sk_value: string | null;
  usage: number | null;
  last_used_at: string | null;
  last_sync_at: string | null;
};

enum ApiKeyPhase {
  PENDING = "Pending",
  CREATED = "Created",
  DELETED = "Deleted",
}

export type ApiUsageRecord = {
  date: string;
  api_key_id: string;
  api_key_name: string;
  endpoint_type: string | null;
  endpoint_name: string;
  model_name: string | null;
  workspace: string;
  usage: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
};
