import {
  useCustom,
  useCustomMutation,
  useInvalidate,
  useList,
} from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import type {
  GroupPolicy,
  GroupPolicySpec,
  GroupPolicySubjectKind,
  GroupTokenPool,
  UserGroupPolicy,
} from "@/domains/group-policy/types";
import { getApiErrorCode } from "@/foundation/lib/api-error-code";

/** The policy of one group; a group has at most one. */
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

const RETURN_ROWS = { headers: { Prefer: "return=representation" } };

/** The RPCs whose answers derive from group policies. */
const POLICY_READ_URLS = new Set([
  "/rpc/get_group_token_pools",
  "/rpc/get_user_group_policy",
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

export const useGroupPolicyWrites = () => {
  const { mutateAsync, isLoading } = useCustomMutation();
  const invalidate = useInvalidate();
  const queryClient = useQueryClient();

  const run = async (
    url: string,
    method: "post" | "patch" | "delete",
    values?: Record<string, unknown>,
  ) => {
    const { data } = await mutateAsync({
      url,
      method,
      values: values ?? {},
      meta: RETURN_ROWS,
      successNotification: false,
      errorNotification: false,
    });
    if (method !== "post" && Array.isArray(data) && data.length === 0) {
      throw new GroupPolicyGoneError();
    }
    // cancelRefetch: a read already in flight started before the write and
    // would otherwise land last with the old policy.
    await Promise.all([
      invalidate({
        resource: "group_policies",
        invalidates: ["list"],
        invalidationOptions: { cancelRefetch: true },
      }),
      queryClient.invalidateQueries(
        { predicate: (query) => readsPolicies(query.queryKey) },
        { cancelRefetch: true },
      ),
    ]);
  };

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
      run(`/group_policies?id=eq.${policy.id}`, "delete"),
    isPending: isLoading,
  };
};

const isDenied = (error: unknown) =>
  getApiErrorCode(error) === "42501" ||
  (error as { statusCode?: number } | null)?.statusCode === 403;

/**
 * A user's merged group policy in a workspace. With workspace null, only the
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
  const denied = isDenied(query.error);
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
  };
};
