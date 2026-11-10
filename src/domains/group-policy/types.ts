import type { Metadata } from "@/foundation/types/basic-types";

export type GroupPolicySubjectKind = "Team" | "OrgUnit";

/** A user or an application, limited on its own in a scope. */
export type PrincipalKind = "User" | "ServiceAccount";

/** Where a User or ServiceAccount policy was set; none: globally. */
export type GroupPolicyScopeKind = "Team" | "OrgUnit";

/** A model in one workspace, or in every workspace when `workspace` is absent. */
export type GroupPolicyModel = {
  model: string;
  workspace?: string;
};

export type GroupTokenPoolPeriod = "daily" | "weekly" | "monthly" | "yearly";

/** One token pool shared by every member of the group. */
export type GroupTokenQuota = {
  limit: number;
  period: GroupTokenPoolPeriod;
};

export type GroupPolicySpec = {
  subject_kind: GroupPolicySubjectKind | PrincipalKind;
  /** A group's metadata.name, or the id of a user or ServiceAccount. */
  subject_name: string;
  scope_kind?: GroupPolicyScopeKind | null;
  scope_name?: string | null;
  /** null or empty: no rule. */
  allowed_models: GroupPolicyModel[] | null;
  denied_models: GroupPolicyModel[] | null;
  /** null: no pool. */
  token_quota?: GroupTokenQuota | null;
};

/** A pool with its usage in the current period (get_group_token_pools). */
export type GroupTokenPool = {
  kind: GroupPolicySubjectKind | PrincipalKind;
  /** A group's metadata.name, or the id of the user or ServiceAccount. */
  name: string;
  /** In get_user_group_policy only, for groups; absent on older servers. */
  display_name?: string | null;
  /** For a User or ServiceAccount pool: where it was set; none: globally. */
  scope_kind?: GroupPolicyScopeKind | null;
  scope_name?: string | null;
  scope_display_name?: string | null;
  token_limit: number;
  period: GroupTokenPoolPeriod;
  used: number;
  remaining: number;
  resets_at: string;
};

export type GroupPolicy = {
  id: number;
  api_version: "v1";
  kind: "GroupPolicy";
  metadata: Metadata;
  spec: GroupPolicySpec;
};

/** One group's share of a user's merged policy (get_user_group_policy). */
export type UserGroupPolicyGroup = {
  kind: GroupPolicySubjectKind;
  name: string;
  /** Absent on older servers. */
  display_name?: string | null;
  active: boolean;
  allowed_models: GroupPolicyModel[] | null;
  denied_models: GroupPolicyModel[] | null;
  token_quota?: GroupTokenQuota | null;
};

/** A policy set on the user or application itself, in one scope. */
export type SubjectPolicy = {
  name: string;
  subject_kind: PrincipalKind;
  scope_kind: GroupPolicyScopeKind | null;
  scope_name: string | null;
  scope_display_name: string | null;
  /** False once the subject left the scope: the policy no longer applies. */
  in_scope: boolean;
  allowed_models: GroupPolicyModel[] | null;
  denied_models: GroupPolicyModel[] | null;
  token_quota: GroupTokenQuota | null;
};

/**
 * A user's or application's merged policy in one workspace. `allowed_models`
 * null: no limit.
 */
export type UserGroupPolicy = {
  allowed_models: string[] | null;
  denied_models: string[] | null;
  groups: UserGroupPolicyGroup[];
  /** Absent on older servers. */
  subject_policies?: SubjectPolicy[];
  /** Every pool the user draws from; the smallest remaining applies. */
  token_pools?: GroupTokenPool[];
};

/** One subject a scope manages, with its policy in that scope (get_scope_subject_policies). */
export type ScopeSubjectPolicy = {
  subject_kind: PrincipalKind;
  subject_name: string;
  /** null: no policy in this scope. */
  policy_name: string | null;
  allowed_models: GroupPolicyModel[] | null;
  denied_models: GroupPolicyModel[] | null;
  token_quota: GroupTokenQuota | null;
  /** The pool of this scope's policy; null without one. */
  used: number | null;
  remaining: number | null;
  resets_at: string | null;
  /** The least remaining of every pool that applies; null: no limit. */
  effective_remaining: number | null;
};

/** A Team or an OrgUnit; `id` checks the caller's permissions on it. */
export type PolicyScope = {
  kind: GroupPolicyScopeKind;
  name: string;
  id: number;
};
