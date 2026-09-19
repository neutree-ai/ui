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
  // Optional per-entry token quota for the key's quota period (the period is
  // shared by the whole key — there is deliberately no per-entry period).
  // Absent = no quota on this entry, i.e. unlimited; it is never 0, which the
  // backend rejects outright (disabling a key is the separate `disabled` flag).
  // As soon as ANY entry carries a token_limit, the key's overall token_quota
  // stops being enforced; the granularity is derived from the data, not stored
  // as a mode flag.
  token_limit?: number;
  // Read-only, computed by get_api_key_limits and only present on entries that
  // carry a token_limit. `remaining` may be negative (usage overshot the limit,
  // which a soft quota permits) — render that as exhausted, not as broken.
  used?: number;
  remaining?: number;
};

// Which quota is actually in force for a key. Derived by the backend from
// whether any allowed_models entry carries a token_limit; read it rather than
// inferring from the presence of token_quota, which is retained in per-model
// mode so clearing the entry limits falls back to it.
export type QuotaGranularity = "overall" | "per_model";

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
  // Read-only, computed by get_api_key_limits (never written back).
  quota_granularity?: QuotaGranularity;
  // The key's single quota period, echoed by get_api_key_limits (defaults to
  // "monthly"). Authoritative in per-model mode, where token_quota.period may be
  // absent but every entry limit still resets on this period.
  quota_period?: string;
};

export type ApiKey = {
  id: string;
  api_version: "v1";
  kind: "ApiKey";
  metadata: Metadata;
  spec: ApiKeySpec;
  status: ApiKeyStatus | null;
};

export type ApiKeyProject = {
  id: string;
  api_version: "v1";
  kind: "ApiKeyProject";
  metadata: Metadata;
  spec: { description: string };
  user_id: string;
  is_ungrouped?: boolean;
};

export type ApiKeySpec = {
  quota: number;
  expires_in?: number | null;
  project_id?: string | null;
  description?: string;
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
  api_key_display_name?: string | null;
  api_key_description?: string;
  endpoint_type: string | null;
  endpoint_name: string;
  model_name: string | null;
  workspace: string;
  usage: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
};
