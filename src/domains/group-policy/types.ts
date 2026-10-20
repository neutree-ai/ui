import type { Metadata } from "@/foundation/types/basic-types";

export type GroupPolicySubjectKind = "Team" | "OrgUnit";

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
  subject_kind: GroupPolicySubjectKind;
  subject_name: string;
  /** null or empty: no rule. */
  allowed_models: GroupPolicyModel[] | null;
  denied_models: GroupPolicyModel[] | null;
  /** null: no pool. */
  token_quota?: GroupTokenQuota | null;
};

/** A pool with its usage in the current period (get_group_token_pools). */
export type GroupTokenPool = {
  kind: GroupPolicySubjectKind;
  name: string;
  /** In get_user_group_policy only; absent on older servers. */
  display_name?: string | null;
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

/** A user's merged policy in one workspace. `allowed_models` null: no limit. */
export type UserGroupPolicy = {
  allowed_models: string[] | null;
  denied_models: string[] | null;
  groups: UserGroupPolicyGroup[];
  /** Every pool the user draws from; the smallest remaining applies. */
  token_pools?: GroupTokenPool[];
};
