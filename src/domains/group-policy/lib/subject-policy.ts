import { hasRules } from "@/domains/group-policy/lib/model-entries";
import type {
  GroupPolicyModel,
  GroupPolicyScopeKind,
  GroupPolicySpec,
  GroupPolicySubjectKind,
  GroupTokenPool,
  GroupTokenQuota,
  PolicyScope,
  PrincipalKind,
  UserGroupPolicy,
} from "@/domains/group-policy/types";

/**
 * The spec of a User or ServiceAccount policy in `scope`. Every field goes
 * out: a PATCH replaces the spec, so a field left out would be cleared.
 * `denied` carries over what the dialog does not edit.
 */
export const buildSubjectPolicySpec = (
  subject: { kind: PrincipalKind; id: string },
  scope: Pick<PolicyScope, "kind" | "name">,
  allowed: GroupPolicyModel[],
  denied: GroupPolicyModel[] | null,
  tokenQuota: GroupTokenQuota | null,
): GroupPolicySpec => ({
  subject_kind: subject.kind,
  subject_name: subject.id,
  scope_kind: scope.kind,
  scope_name: scope.name,
  allowed_models: allowed.length > 0 ? allowed : null,
  denied_models: denied && denied.length > 0 ? denied : null,
  token_quota: tokenQuota,
});

/**
 * What saving the dialog does: nothing for an empty new policy, delete for a
 * policy emptied of every rule, otherwise a write.
 */
export const subjectPolicyChange = (
  existing: string | null,
  spec: GroupPolicySpec,
): "none" | "remove" | "save" =>
  hasRules(spec) ? "save" : existing ? "remove" : "none";

/** Where a pool comes from: a group's shared pool, or the subject's own one set in a scope. */
export type TokenPoolSource =
  | {
      owner: "group";
      kind: GroupPolicySubjectKind;
      name: string;
      label: string;
    }
  | {
      owner: "subject";
      /** null: set globally. */
      scopeKind: GroupPolicyScopeKind | null;
      scopeName: string | null;
      scopeLabel: string | null;
    };

export const tokenPoolSource = (
  pool: Pick<
    GroupTokenPool,
    | "kind"
    | "name"
    | "display_name"
    | "scope_kind"
    | "scope_name"
    | "scope_display_name"
  >,
): TokenPoolSource =>
  pool.kind === "Team" || pool.kind === "OrgUnit"
    ? {
        owner: "group",
        kind: pool.kind,
        name: pool.name,
        label: pool.display_name?.trim() || pool.name,
      }
    : {
        owner: "subject",
        scopeKind: pool.scope_kind ?? null,
        scopeName: pool.scope_name ?? null,
        scopeLabel: pool.scope_kind
          ? pool.scope_display_name?.trim() || pool.scope_name || null
          : null,
      };

type PolicyModelRule = {
  key: string;
  source: TokenPoolSource;
  allowed: GroupPolicyModel[];
  denied: GroupPolicyModel[];
  /** False for a subject policy whose subject left its scope. */
  applies: boolean;
};

/**
 * The model rules of every policy on a subject but the one named `exclude`
 * (the one being edited): its groups', then its own in other scopes. Policies
 * with a pool only are left out; pools are listed apart.
 */
export const otherPolicyRules = (
  policy: Pick<UserGroupPolicy, "groups" | "subject_policies">,
  exclude: string | null,
): PolicyModelRule[] =>
  [
    ...policy.groups.map((group) => ({
      key: `${group.kind}/${group.name}`,
      source: {
        owner: "group" as const,
        kind: group.kind,
        name: group.name,
        label: group.display_name?.trim() || group.name,
      },
      allowed: group.allowed_models ?? [],
      denied: group.denied_models ?? [],
      // An inactive group's policy still applies.
      applies: true,
    })),
    ...(policy.subject_policies ?? [])
      .filter((own) => own.name !== exclude)
      .map((own) => ({
        key: own.name,
        source: tokenPoolSource({
          kind: own.subject_kind,
          name: "",
          scope_kind: own.scope_kind,
          scope_name: own.scope_name,
          scope_display_name: own.scope_display_name,
        }),
        allowed: own.allowed_models ?? [],
        denied: own.denied_models ?? [],
        applies: own.in_scope,
      })),
  ].filter((rule) => rule.allowed.length + rule.denied.length > 0);
