import type { Metadata } from "@/foundation/types/basic-types";

// One entry of the model allowlist, scoped to the IE/EE (internal/external
// endpoint) dimension. A request is allowed when its model equals `model` and,
// for each of `type` / `endpoint_name` that is set, the endpoint it hit matches.
// Both absent = "any endpoint serving this model" (the legacy name-only entries
// migrated keys carry). Mirrors the backend api/v1 AllowedModel.
export type AllowedModel = {
  model: string;
  type?: "internal" | "external";
  endpoint_name?: string;
};

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
  allowed_models?: AllowedModel[];
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
  description: string;
};

export type ApiKeyProject = {
  id: string;
  name: string;
  description: string;
  workspace: string;
  enabled: boolean;
  is_default: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
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
