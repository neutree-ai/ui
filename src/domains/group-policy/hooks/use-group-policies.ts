import {
  useCustom,
  useCustomMutation,
  useDataProvider,
  useInvalidate,
  useList,
} from "@refinedev/core";
import { useQueries } from "@tanstack/react-query";
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

export const useGroupPolicyWrites = () => {
  const { mutateAsync, isLoading } = useCustomMutation();
  const invalidate = useInvalidate();

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
    await invalidate({ resource: "group_policies", invalidates: ["list"] });
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
 * A user's merged group policy in a workspace. `denied` when the caller is
 * neither the user nor holds a global group_policy:read.
 */
export const useUserGroupPolicy = (
  userId: string,
  workspace: string,
  enabled: boolean,
) => {
  const query = useCustom<UserGroupPolicy>({
    url: "/rpc/get_user_group_policy",
    method: "post",
    config: { payload: { p_user_id: userId, p_workspace: workspace } },
    queryOptions: { enabled: enabled && workspace !== "", retry: false },
    successNotification: false,
    errorNotification: false,
  });
  const denied = isDenied(query.error);
  return {
    policy: query.data?.data as UserGroupPolicy | undefined,
    isLoading: enabled && workspace !== "" && query.isLoading,
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
    refetch: query.refetch,
  };
};

/** Client-facing model names served in the given workspaces, for suggestions. */
export const useModelCandidates = (workspaces: string[]) => {
  const dataProvider = useDataProvider();
  const results = useQueries({
    queries: workspaces.map((workspace) => ({
      queryKey: ["group-policy", "workspace-models", workspace],
      queryFn: async () => {
        const result = await dataProvider().custom?.({
          url: "/rpc/get_workspace_models",
          method: "post",
          payload: { p_workspace: workspace },
        });
        return (result?.data as { model?: string | null }[] | null) ?? [];
      },
      staleTime: 60_000,
    })),
  });
  const models = new Set<string>();
  for (const result of results) {
    for (const row of result.data ?? []) {
      const model = String(row.model ?? "").trim();
      if (model) models.add(model);
    }
  }
  return [...models].sort((a, b) => a.localeCompare(b));
};
