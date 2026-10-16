import type { Metadata } from "@/foundation/types/basic-types";

export type GroupPolicySubjectKind = "Team" | "OrgUnit";

/** A model in one workspace, or in every workspace when `workspace` is absent. */
export type GroupPolicyModel = {
  model: string;
  workspace?: string;
};

export type GroupPolicySpec = {
  subject_kind: GroupPolicySubjectKind;
  subject_name: string;
  /** null or empty: no rule. */
  allowed_models: GroupPolicyModel[] | null;
  denied_models: GroupPolicyModel[] | null;
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
  active: boolean;
  allowed_models: GroupPolicyModel[] | null;
  denied_models: GroupPolicyModel[] | null;
};

/** A user's merged policy in one workspace. `allowed_models` null: no limit. */
export type UserGroupPolicy = {
  allowed_models: string[] | null;
  denied_models: string[] | null;
  groups: UserGroupPolicyGroup[];
};
