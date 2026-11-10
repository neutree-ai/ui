import { useCustom, useList } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import type {
  GroupPolicy,
  GroupPolicySpec,
  GroupPolicySubjectKind,
  GroupTokenPool,
  PolicyScope,
  ScopeSubjectPolicy,
  UserGroupPolicy,
} from "@/domains/group-policy/types";
import {
  useHasOrgUnitPermission,
  useHasTeamPermission,
} from "@/foundation/hooks/use-has-permission";
import { useRowWrite } from "@/foundation/hooks/use-row-write";
import { isPermissionDenied } from "@/foundation/lib/api-error-code";

/** The policy of one group; a group has at most one. Subject policies never match. */
export const useGroupPolicy = (
  kind: GroupPolicySubjectKind,
  name: string,
  enabled: boolean,
) => {
  const query = useList<GroupPolicy>({
    resource: "group_policies",
    pagination: { mode: "off" },
    filters: [
      { field: "spec->>subject_kind", operator: "eq", value: kind },
      { field: "spec->>subject_name", operator: "eq", value: name },
    ],
    queryOptions: { enabled: enabled && name !== "" },
  });
  return {
    policy: query.data?.data?.[0],
    isLoading: enabled && query.isLoading,
    error: query.error,
  };
};

/** A PATCH or DELETE that changed no row: someone else removed the policy. */
export class GroupPolicyGoneError extends Error {
  constructor() {
    super("The group policy no longer exists");
    this.name = "GroupPolicyGoneError";
  }
}

/** The RPCs whose answers derive from group policies. */
const POLICY_READ_URLS = new Set([
  "/rpc/get_group_token_pools",
  "/rpc/get_user_group_policy",
  "/rpc/get_scope_subject_policies",
]);

// refine keys a custom query by its url: a plain segment in the legacy key
// shape, a field of the params segment in the new one.
const readsPolicies = (key: readonly unknown[]) =>
  key.some((part) =>
    POLICY_READ_URLS.has(
      String(
        typeof part === "object" && part !== null
          ? (part as { url?: unknown }).url
          : part,
      ),
    ),
  );

const byName = (name: string) =>
  `/group_policies?metadata->>name=eq.${encodeURIComponent(name)}`;

export const useGroupPolicyWrites = () => {
  const queryClient = useQueryClient();
  // cancelRefetch: a read already in flight started before the write and
  // would otherwise land last with the old policy.
  const { run, isPending } = useRowWrite({
    invalidates: ["group_policies"],
    onNoRow: () => new GroupPolicyGoneError(),
    cancelRefetch: true,
    invalidateMore: () =>
      queryClient.invalidateQueries(
        { predicate: (query) => readsPolicies(query.queryKey) },
        { cancelRefetch: true },
      ),
  });

  return {
    /** Create when `existing` is absent; otherwise replace its spec. */
    save: (existing: GroupPolicy | undefined, spec: GroupPolicySpec) =>
      existing
        ? run(`/group_policies?id=eq.${existing.id}`, "patch", { spec })
        : run("/group_policies", "post", {
            api_version: "v1",
            kind: "GroupPolicy",
            metadata: {},
            spec,
          }),
    remove: (policy: GroupPolicy) =>
      run(`/group_policies?id=eq.${policy.id}`, "delete", {}),
    /** Create when `name` is null; otherwise replace the spec of the policy named so. */
    saveByName: (name: string | null, spec: GroupPolicySpec) =>
      name
        ? run(byName(name), "patch", { spec })
        : run("/group_policies", "post", {
            api_version: "v1",
            kind: "GroupPolicy",
            metadata: {},
            spec,
          }),
    removeByName: (name: string) => run(byName(name), "delete", {}),
    isPending,
  };
};

/**
 * A user's or application's merged group policy in a workspace (`userId` may
 * be a ServiceAccount id). With workspace null, only the
 * groups and pools (no merged lists); "" waits. `denied` when the caller
 * holds no group_policy:read on the user and is not the user.
 */
export const useUserGroupPolicy = (
  userId: string,
  workspace: string | null,
  enabled: boolean,
) => {
  const ready = enabled && workspace !== "";
  const query = useCustom<UserGroupPolicy>({
    url: "/rpc/get_user_group_policy",
    method: "post",
    config: { payload: { p_user_id: userId, p_workspace: workspace } },
    queryOptions: { enabled: ready, retry: false },
    successNotification: false,
    errorNotification: false,
  });
  const denied = isPermissionDenied(query.error);
  return {
    policy: query.data?.data as UserGroupPolicy | undefined,
    isLoading: ready && query.isLoading,
    denied,
    error: denied ? null : query.error,
  };
};

/** The token pool of one group with its usage in the current period. */
export const useGroupTokenPool = (
  kind: GroupPolicySubjectKind,
  name: string,
  enabled: boolean,
) => {
  const query = useCustom<GroupTokenPool[]>({
    url: "/rpc/get_group_token_pools",
    method: "post",
    config: { payload: { p_kind: kind, p_name: name } },
    queryOptions: { enabled: enabled && name !== "", retry: false },
    successNotification: false,
    errorNotification: false,
  });
  const rows = query.data?.data as GroupTokenPool[] | undefined;
  return {
    pool: rows?.[0],
    error: query.error,
    isLoading: enabled && name !== "" && query.isLoading,
  };
};

/**
 * Every user (and, in a Team, every application) a scope manages, with its
 * policy in that scope. `denied` when the caller holds no group_policy:read on
 * the scope.
 */
export const useScopeSubjectPolicies = (
  scope: Pick<PolicyScope, "kind" | "name">,
  enabled: boolean,
) => {
  const ready = enabled && scope.name !== "";
  const query = useCustom<ScopeSubjectPolicy[]>({
    url: "/rpc/get_scope_subject_policies",
    method: "post",
    config: {
      payload: { p_scope_kind: scope.kind, p_scope_name: scope.name },
    },
    queryOptions: { enabled: ready, retry: false },
    successNotification: false,
    errorNotification: false,
  });
  const denied = isPermissionDenied(query.error);
  return {
    rows: query.data?.data as ScopeSubjectPolicy[] | undefined,
    isLoading: ready && query.isLoading,
    denied,
    error: denied ? null : query.error,
  };
};

/**
 * What the caller may do with the subject policies of a scope: globally, or
 * through a role assignment on that Team or OrgUnit (and, for an OrgUnit, its
 * ancestors). The server checks every write regardless.
 */
const useScopePermission = (
  permission: string,
  scope: PolicyScope | undefined,
) => {
  // Both run; the one for the other kind skips its check.
  const onTeam = useHasTeamPermission(
    permission,
    scope?.kind === "Team" ? scope.id : undefined,
  );
  const onUnit = useHasOrgUnitPermission(
    permission,
    scope?.kind === "OrgUnit" ? scope.id : undefined,
  );
  return onTeam.allowed === true || onUnit.allowed === true;
};

export const useScopePolicyAccess = (scope: PolicyScope | undefined) => ({
  canRead: useScopePermission("group_policy:read", scope),
  canCreate: useScopePermission("group_policy:create", scope),
  canUpdate: useScopePermission("group_policy:update", scope),
  canDelete: useScopePermission("group_policy:delete", scope),
});
