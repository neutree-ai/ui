import { useCustom, useList } from "@refinedev/core";
import type {
  OrgUnit,
  OrgUnitMember,
  Team,
  TeamMember,
} from "@/domains/organization/types";

// The page builds the tree locally, so it needs every row at once.
const ALL = { mode: "off" } as const;

export const useOrgUnits = () =>
  useList<OrgUnit>({ resource: "org_units", pagination: ALL });

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
