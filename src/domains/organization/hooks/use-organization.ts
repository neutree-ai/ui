import {
  useCustom,
  useCustomMutation,
  useInvalidate,
  useList,
} from "@refinedev/core";
import type {
  OrgUnit,
  OrgUnitMember,
  Team,
  TeamMember,
} from "@/domains/organization/types";

// The page builds the tree locally, so it needs every row at once.
const ALL = { mode: "off" } as const;

export const useOrgUnits = (enabled = true) =>
  useList<OrgUnit>({
    resource: "org_units",
    pagination: ALL,
    queryOptions: { enabled },
  });

export const useTeams = () =>
  useList<Team>({ resource: "teams", pagination: ALL });

/**
 * Members of one OrgUnit, or of its whole subtree (through the
 * org_unit_subtree_members RPC, which runs under the caller's RLS).
 */
export const useOrgUnitMembers = (
  orgUnitId: number | undefined,
  includeSubtree: boolean,
) => {
  const direct = useList<OrgUnitMember>({
    resource: "org_unit_members",
    pagination: ALL,
    filters: [{ field: "org_unit_id", operator: "eq", value: orgUnitId }],
    meta: { select: "*,user_profiles(*)" },
    queryOptions: { enabled: orgUnitId !== undefined && !includeSubtree },
  });
  const subtree = useCustom<OrgUnitMember[]>({
    url: "/rpc/org_unit_subtree_members?select=*,user_profiles(*),org_units(*)",
    method: "post",
    config: { payload: { p_org_unit_id: orgUnitId } },
    queryOptions: { enabled: orgUnitId !== undefined && includeSubtree },
    successNotification: false,
    errorNotification: false,
  });
  const query = includeSubtree ? subtree : direct;
  return {
    members: (query.data?.data ?? []) as OrgUnitMember[],
    isLoading: orgUnitId !== undefined && query.isLoading,
    error: query.error,
  };
};

export const useTeamMembers = (teamId: number | undefined) => {
  const query = useList<TeamMember>({
    resource: "team_members",
    pagination: ALL,
    filters: [{ field: "team_id", operator: "eq", value: teamId }],
    meta: { select: "*,user_profiles(*)" },
    queryOptions: { enabled: teamId !== undefined },
  });
  return {
    members: query.data?.data ?? [],
    isLoading: teamId !== undefined && query.isLoading,
    error: query.error,
  };
};

/** The primary department of a user: at most one row (user_id is the key). */
export const useUserOrgUnit = (userId: string, enabled: boolean) => {
  const query = useList<OrgUnitMember>({
    resource: "org_unit_members",
    pagination: ALL,
    filters: [{ field: "user_id", operator: "eq", value: userId }],
    meta: { select: "*,org_units(*)" },
    queryOptions: { enabled },
  });
  return {
    membership: query.data?.data[0] ?? null,
    isLoading: enabled && query.isLoading,
    error: query.error,
  };
};

export const useUserTeams = (userId: string, enabled: boolean) => {
  const query = useList<TeamMember>({
    resource: "team_members",
    pagination: ALL,
    filters: [{ field: "user_id", operator: "eq", value: userId }],
    meta: { select: "*,teams(*)" },
    queryOptions: { enabled },
  });
  return {
    members: query.data?.data ?? [],
    isLoading: enabled && query.isLoading,
    error: query.error,
  };
};

/**
 * Hand assignment of a local user's department. identity_source is left out:
 * a row with one belongs to sync, and the write policies refuse it.
 */
export const useAssignOrgUnit = (userId: string) => {
  const { mutateAsync, isLoading } = useCustomMutation();
  const invalidate = useInvalidate();
  const url = `/org_unit_members?user_id=eq.${encodeURIComponent(userId)}`;

  const run = async (
    method: "post" | "patch" | "delete",
    values: Record<string, unknown>,
  ) => {
    await mutateAsync({
      url: method === "post" ? "/org_unit_members" : url,
      method,
      values,
      successNotification: false,
      errorNotification: false,
    });
    await Promise.all(
      ["org_unit_members", "user_profiles"].map((resource) =>
        invalidate({ resource, invalidates: ["list"] }),
      ),
    );
  };

  return {
    create: (orgUnitId: number) =>
      run("post", { user_id: userId, org_unit_id: orgUnitId }),
    update: (orgUnitId: number) => run("patch", { org_unit_id: orgUnitId }),
    remove: () => run("delete", {}),
    isPending: isLoading,
  };
};
