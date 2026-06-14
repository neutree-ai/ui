// Access control policies (NEUTREE-GENERAL-9, 1.1 track).
//
// A sibling of quota: access rules are per-request gating / short-window rate
// limits (no period, no cumulative usage). Mirrors api.access_policies on the
// management plane. This UI exposes: rate_limit, concurrency, and the
// model/endpoint allowlists (restrict which models/endpoints a scope may use).

export type AccessLevel = "workspace" | "user" | "api_key";

export const ACCESS_LEVELS: AccessLevel[] = ["workspace", "user", "api_key"];

export type AccessRuleType =
  | "rate_limit"
  | "concurrency"
  | "model_allowlist"
  | "endpoint_allowlist";

export const ACCESS_RULE_TYPES: AccessRuleType[] = [
  "rate_limit",
  "concurrency",
  "model_allowlist",
  "endpoint_allowlist",
];

export type AccessWindow = "second" | "minute" | "hour" | "day";

export const ACCESS_WINDOWS: AccessWindow[] = [
  "second",
  "minute",
  "hour",
  "day",
];

export type AccessEndpointType = "endpoint" | "external_endpoint";

export const ACCESS_ENDPOINT_TYPES: AccessEndpointType[] = [
  "endpoint",
  "external_endpoint",
];

export type AccessEndpointRef = {
  type: AccessEndpointType;
  name: string;
};

// rule_spec shape depends on rule_type:
//   rate_limit         -> { limit, window }
//   concurrency        -> { max }
//   model_allowlist    -> { models: string[] }
//   endpoint_allowlist -> { endpoints: AccessEndpointRef[] }
export type AccessRuleSpec = {
  limit?: number;
  window?: AccessWindow;
  max?: number;
  models?: string[];
  endpoints?: AccessEndpointRef[];
};

// One row of api.access_policies, as returned by /rpc/get_access_policies.
export type AccessPolicy = {
  id: number;
  level: AccessLevel;
  workspace: string;
  user_id: string | null;
  api_key_id: string | null;
  rule_type: AccessRuleType;
  rule_spec: AccessRuleSpec;
  created_at: string;
  updated_at: string;
};

// A policy enriched with a resolved human-readable target name.
export type AccessPolicyRow = AccessPolicy & {
  targetName: string;
};

// Minimal local shapes for the cross-domain lookups (workspace members / api
// keys / endpoints), declared here rather than importing other domains' types to
// respect the no-L2-cross-domain rule.
export type AccessUserLite = {
  id: string;
  metadata?: { name?: string };
  spec?: { email?: string };
};

export type AccessApiKeyLite = {
  id: string;
  metadata?: { name?: string };
};

export type AccessWorkspaceLite = {
  id: number;
  metadata?: { name?: string };
};

export type AccessNamedLite = {
  id: string | number;
  metadata?: { name?: string };
};
