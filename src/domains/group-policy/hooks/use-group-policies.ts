import { useCustom, useInvalidate, useList } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { GroupPolicyGoneError } from "@/domains/group-policy/lib/group-policy-errors";
import type {
  GroupPolicy,
  GroupPolicySpec,
  GroupTokenPool,
  PrincipalKind,
  ScopeSubjectPolicy,
  UserGroupPolicy,
} from "@/domains/group-policy/types";
import {
  useHasOrgUnitPermission,
  useHasTeamPermission,
} from "@/foundation/hooks/use-has-permission";
import { useRowWrite } from "@/foundation/hooks/use-row-write";
import { isPermissionDenied } from "@/foundation/lib/api-error-code";
import type { GroupKind, LabeledScope } from "@/foundation/types/group-scope";

/** The policy of one group; a group has at most one. Subject policies never match. */
export const useGroupPolicy = (
  kind: GroupKind,
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

const USER_POLICY_URL = "/rpc/get_user_group_policy";
const SCOPE_POLICIES_URL = "/rpc/get_scope_subject_policies";
/** Every read derived from group policies. */
const POLICY_READ_URLS = [
  "/rpc/get_group_token_pools",
  USER_POLICY_URL,
  SCOPE_POLICIES_URL,
];

// refine keys a custom query by its url and its payload, in a legacy and a
// new key shape; both serialize them as plain JSON fields.
const readsCustom = (
  key: readonly unknown[],
  url: string,
  payload: Record<string, unknown> = {},
) => {
  const text = JSON.stringify(key);
  return (
    text.includes(JSON.stringify(url)) &&
    Object.entries(payload).every(([field, value]) =>
      text.includes(`${JSON.stringify(field)}:${JSON.stringify(value)}`),
    )
  );
};

type PolicyTarget = Pick<
  GroupPolicySpec,
  "subject_kind" | "subject_name" | "scope_kind" | "scope_name"
>;

/**
 * The reads a write to `target` changes. A group policy reaches every member,
 * so every derived read; a user's or application's own one only its merged
 * policy and the scope it was set in.
 */
const affectedBy = (target: PolicyTarget) => (key: readonly unknown[]) =>
  target.subject_kind === "Team" || target.subject_kind === "OrgUnit"
    ? POLICY_READ_URLS.some((url) => readsCustom(key, url))
    : readsCustom(key, USER_POLICY_URL, { p_user_id: target.subject_name }) ||
      (!!target.scope_kind &&
        readsCustom(key, SCOPE_POLICIES_URL, {
          p_scope_kind: target.scope_kind,
          p_scope_name: target.scope_name,
        }));

export const useGroupPolicyWrites = () => {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  const { run, isPending } = useRowWrite({
    invalidates: [],
    onNoRow: () => new GroupPolicyGoneError(),
  });

  // cancelRefetch: a read already in flight started before the write and
  // would otherwise land last with the old policy.
  const write = async (
    url: string,
    method: "post" | "patch" | "delete",
    values: unknown,
    target: PolicyTarget,
  ) => {
    const rows = await run(url, method, values);
    const group =
      target.subject_kind === "Team" || target.subject_kind === "OrgUnit";
    await Promise.all([
      group &&
        invalidate({
          resource: "group_policies",
          invalidates: ["list"],
          invalidationOptions: { cancelRefetch: true },
        }),
      queryClient.invalidateQueries(
        { predicate: (query) => affectedBy(target)(query.queryKey) },
        { cancelRefetch: true },
      ),
    ]);
    return rows;
  };

  return {
    /** Create when `existing` is absent; otherwise replace its spec. */
    save: (
      existing: Pick<GroupPolicy, "id"> | undefined,
      spec: GroupPolicySpec,
    ) =>
      existing
        ? write(`/group_policies?id=eq.${existing.id}`, "patch", { spec }, spec)
        : write(
            "/group_policies",
            "post",
            { api_version: "v1", kind: "GroupPolicy", metadata: {}, spec },
            spec,
          ),
    remove: (policy: Pick<GroupPolicy, "id"> & { spec: PolicyTarget }) =>
      write(`/group_policies?id=eq.${policy.id}`, "delete", {}, policy.spec),
    isPending,
  };
};

export type GroupPolicyWrites = ReturnType<typeof useGroupPolicyWrites>;

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
    url: USER_POLICY_URL,
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
  kind: GroupKind,
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

export const subjectKey = (kind: PrincipalKind, id: string) => `${kind}/${id}`;

/**
 * Every user (and, in a Team, every application) a scope manages, with its
 * policy in that scope, by subjectKey. `denied` when the caller holds no
 * group_policy:read on the scope.
 */
export const useScopeSubjectPolicies = (
  scope: Pick<LabeledScope, "kind" | "name">,
  enabled: boolean,
) => {
  const ready = enabled && scope.name !== "";
  const query = useCustom<
    ScopeSubjectPolicy[],
    never,
    unknown,
    unknown,
    { bySubject: Map<string, ScopeSubjectPolicy> }
  >({
    url: SCOPE_POLICIES_URL,
    method: "post",
    config: {
      payload: { p_scope_kind: scope.kind, p_scope_name: scope.name },
    },
    queryOptions: {
      enabled: ready,
      retry: false,
      select: (response) => ({
        ...response,
        data: {
          bySubject: new Map(
            response.data.map((row) => [
              subjectKey(row.subject_kind, row.subject_name),
              row,
            ]),
          ),
        },
      }),
    },
    successNotification: false,
    errorNotification: false,
  });
  const denied = isPermissionDenied(query.error);
  return {
    bySubject: query.data?.data.bySubject,
    isLoading: ready && query.isLoading,
    denied,
    error: denied ? null : query.error,
  };
};

// Both run; the one for the other kind skips its check, and so do both
// until `enabled`.
const useScopePermission = (
  permission: string,
  scope: LabeledScope | undefined,
  enabled = true,
) => {
  const id = enabled ? scope?.id : undefined;
  const onTeam = useHasTeamPermission(
    permission,
    scope?.kind === "Team" ? id : undefined,
  );
  const onUnit = useHasOrgUnitPermission(
    permission,
    scope?.kind === "OrgUnit" ? id : undefined,
  );
  return onTeam.allowed === true || onUnit.allowed === true;
};

/**
 * What the caller may do with the subject policies of a scope: globally, or
 * through a role assignment on that Team or OrgUnit (and, for an OrgUnit, its
 * ancestors). The server checks every write regardless.
 */
export const useScopePolicyAccess = (scope: LabeledScope | undefined) => {
  const canRead = useScopePermission("group_policy:read", scope);
  return {
    canRead,
    canCreate: useScopePermission("group_policy:create", scope, canRead),
    canUpdate: useScopePermission("group_policy:update", scope, canRead),
    canDelete: useScopePermission("group_policy:delete", scope, canRead),
  };
};
