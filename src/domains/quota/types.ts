// Quota & usage control (NEUTREE-GENERAL-9).
//
// Three-tier token quota (workspace -> user -> api_key); at most one policy per
// (level, scope, period). Mirrors api.quota_policies on the management plane.

export type QuotaLevel = "workspace" | "user" | "api_key";

export type QuotaPeriod = "daily" | "weekly" | "monthly" | "yearly";

export const QUOTA_LEVELS: QuotaLevel[] = ["workspace", "user", "api_key"];

export const QUOTA_PERIODS: QuotaPeriod[] = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

// Optional dimension a policy can be scoped to (independent overlay constraint).
export type QuotaDimensionType = "endpoint" | "external_endpoint" | "model";

export const QUOTA_DIMENSION_TYPES: QuotaDimensionType[] = [
  "endpoint",
  "external_endpoint",
  "model",
];

// One row of api.quota_policies, as returned by /rpc/get_quota_policies.
export type QuotaPolicy = {
  id: number;
  level: QuotaLevel;
  workspace: string;
  user_id: string | null;
  api_key_id: string | null;
  period: QuotaPeriod;
  limit_tokens: number;
  dimension_type: QuotaDimensionType | null;
  dimension_value: string | null;
  created_at: string;
  updated_at: string;
};

// A policy enriched with the current-period token usage for its scope, plus a
// resolved human-readable name for the target (workspace / user / api key).
export type QuotaPolicyRow = QuotaPolicy & {
  usage: number;
  remaining: number;
  targetName: string;
};

// Minimal local shapes for the cross-domain lookups the quota UI needs
// (workspace members / api keys). Declared here rather than importing
// user/api-key/role-assignment domain types, to respect the no-L2-cross-domain
// architecture rule; only the fields the quota UI reads are modeled.
export type QuotaUserLite = {
  id: string;
  metadata?: { name?: string };
  spec?: { email?: string };
};

export type QuotaApiKeyLite = {
  id: string;
  metadata?: { name?: string };
};

export type QuotaWorkspaceLite = {
  id: number;
  metadata?: { name?: string };
};

// endpoints / external_endpoints picked as a dimension value (by name).
export type QuotaNamedLite = {
  id: string | number;
  metadata?: { name?: string };
};
