import { useCustom, useList } from "@refinedev/core";
import { orgTreeIndex, teamIndex } from "@/domains/organization/lib/org-tree";
import { withProjectLabel } from "@/domains/organization/lib/team";
import type {
  MemberProfile,
  OrgUnit,
  OrgUnitMember,
  Team,
  TeamFormValues,
  TeamMember,
} from "@/domains/organization/types";
import { useRowWrite } from "@/foundation/hooks/use-row-write";

// The page builds the tree locally, so it needs every row at once.
const ALL = { mode: "off" } as const;

// Departments and Teams change rarely; many labels on a page read them.
const STALE_TIME = 60_000;

export const useOrgUnits = (enabled = true) =>
  useList<OrgUnit>({
    resource: "org_units",
    pagination: ALL,
    queryOptions: { enabled, staleTime: STALE_TIME },
  });

export const useTeams = (enabled = true) =>
  useList<Team>({
    resource: "teams",
    pagination: ALL,
    queryOptions: { enabled, staleTime: STALE_TIME },
  });

const NO_UNITS: OrgUnit[] = [];
const NO_TEAMS: Team[] = [];

/** The department forest the caller can read, with lookups by id and name. */
export const useOrgTree = (enabled = true) => {
  const { data, isLoading, error } = useOrgUnits(enabled);
  return {
    ...orgTreeIndex(data?.data ?? NO_UNITS),
    isLoading: enabled && isLoading,
    error,
  };
};

/** Teams, Active first and then by display name, with a lookup by name. */
export const useTeamsByName = (enabled = true) => {
  const { data, isLoading } = useTeams(enabled);
  return {
    ...teamIndex(data?.data ?? NO_TEAMS),
    isLoading: enabled && isLoading,
  };
};

/**
 * The Teams the caller may open as a usage scope, as get_readable_usage_teams
 * decides it, indexed as useTeamsByName.
 */
export const useReadableUsageTeams = () => {
  const { data, isLoading } = useCustom<Team[]>({
    url: "/rpc/get_readable_usage_teams",
    method: "post",
    config: { payload: {} },
    queryOptions: { staleTime: STALE_TIME },
    successNotification: false,
    errorNotification: false,
  });
  return { ...teamIndex(data?.data ?? NO_TEAMS), isLoading };
};

const NO_MEMBERS: OrgUnitMember[] = [];

// The member fields the tables show.
const MEMBER_PROFILE = "user_profiles(id,metadata,spec)";

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
    meta: { select: `*,${MEMBER_PROFILE}` },
    queryOptions: {
      enabled: orgUnitId !== undefined && !includeSubtree,
      staleTime: STALE_TIME,
    },
  });
  const subtree = useCustom<OrgUnitMember[]>({
    // org_units names a member's department when the tree lacks it.
    url: `/rpc/org_unit_subtree_members?select=*,${MEMBER_PROFILE},org_units(*)`,
    method: "post",
    config: { payload: { p_org_unit_id: orgUnitId } },
    queryOptions: {
      enabled: orgUnitId !== undefined && includeSubtree,
      staleTime: STALE_TIME,
    },
    successNotification: false,
    errorNotification: false,
  });
  const query = includeSubtree ? subtree : direct;
  return {
    members: (query.data?.data ?? NO_MEMBERS) as OrgUnitMember[],
    isLoading: orgUnitId !== undefined && query.isLoading,
    error: query.error,
  };
};

const NO_TEAM_MEMBERS: TeamMember[] = [];

export const useTeamMembers = (teamId: number | undefined) => {
  const query = useList<TeamMember>({
    resource: "team_members",
    pagination: ALL,
    filters: [{ field: "team_id", operator: "eq", value: teamId }],
    meta: { select: "*,user_profiles(*)" },
    queryOptions: { enabled: teamId !== undefined, staleTime: STALE_TIME },
  });
  return {
    members: query.data?.data ?? NO_TEAM_MEMBERS,
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
 * RLS hides a membership outside the caller's subtree, so PATCH and DELETE
 * change no row instead of failing.
 */
export class MembershipOutOfScopeError extends Error {
  constructor() {
    super("The membership is outside the caller's departments");
    this.name = "MembershipOutOfScopeError";
  }
}

/**
 * Hand assignment of a local user's department. identity_source is left out:
 * a row with one belongs to sync, and the write policies refuse it.
 */
export const useAssignOrgUnit = (userId: string) => {
  const { run, isPending } = useRowWrite({
    invalidates: ["org_unit_members", "user_profiles"],
    onNoRow: () => new MembershipOutOfScopeError(),
  });
  const url = `/org_unit_members?user_id=eq.${encodeURIComponent(userId)}`;

  return {
    create: async (orgUnitId: number) => {
      await run("/org_unit_members", "post", {
        user_id: userId,
        org_unit_id: orgUnitId,
      });
    },
    update: async (orgUnitId: number) => {
      await run(url, "patch", { org_unit_id: orgUnitId });
    },
    remove: async () => {
      await run(url, "delete", {});
    },
    isPending,
  };
};

/**
 * Puts a user just created by hand into a department. The user id comes from
 * the create response, so it is an argument, not part of the hook.
 */
export const useCreateOrgUnitMembership = () => {
  const { run } = useRowWrite({
    invalidates: ["org_unit_members", "user_profiles"],
  });
  return async (userId: string, orgUnitId: number) => {
    await run("/org_unit_members", "post", {
      user_id: userId,
      org_unit_id: orgUnitId,
    });
  };
};

/**
 * A PATCH or DELETE that changed no row: the Team or membership is gone, or
 * RLS hides it from the caller.
 */
export class TeamWriteNoRowError extends Error {
  constructor(readonly target: "team" | "member") {
    super(`The ${target} no longer exists or cannot be changed`);
    this.name = "TeamWriteNoRowError";
  }
}

const useTeamWrite = (target: "team" | "member") =>
  useRowWrite({
    invalidates: ["teams", "team_members"],
    onNoRow: () => new TeamWriteNoRowError(target),
  });

/** Create, edit and delete manual Teams. Synced Teams are read-only. */
export const useTeamWrites = () => {
  const { run, isPending } = useTeamWrite("team");
  const byId = (id: number) => `/teams?id=eq.${id}`;

  return {
    create: async (values: TeamFormValues) => {
      const rows = await run("/teams", "post", {
        api_version: "v1",
        kind: "Team",
        metadata: {
          name: values.name,
          display_name: values.displayName,
          labels: withProjectLabel(undefined, values.project),
        },
        spec: { identity_source: null, external_id: null },
      });
      return (rows?.[0] as Team | undefined) ?? undefined;
    },
    // The whole metadata goes back: PATCH of a composite column nulls the
    // fields it leaves out.
    update: (team: Team, values: Omit<TeamFormValues, "name">) =>
      run(byId(team.id), "patch", {
        metadata: {
          ...team.metadata,
          display_name: values.displayName,
          labels: withProjectLabel(team.metadata.labels, values.project),
        },
      }),
    remove: (team: Team) => run(byId(team.id), "delete"),
    isPending,
  };
};

/** Add or remove members of a manual Team. */
export const useTeamMemberWrites = (teamId: number | undefined) => {
  const { run, isPending } = useTeamWrite("member");

  return {
    add: (userIds: string[]) =>
      run(
        "/team_members",
        "post",
        userIds.map((userId) => ({ team_id: teamId, user_id: userId })),
      ),
    remove: (userId: string) =>
      run(
        `/team_members?team_id=eq.${teamId}&user_id=eq.${encodeURIComponent(userId)}`,
        "delete",
      ),
    isPending,
  };
};

/** Every department membership the caller can read (RLS scopes the rows). */
export const useAllOrgUnitMembers = (enabled: boolean) =>
  useList<OrgUnitMember>({
    resource: "org_unit_members",
    pagination: ALL,
    meta: { select: "user_id,org_unit_id" },
    queryOptions: { enabled },
  });

export const useAllUsers = (enabled: boolean) =>
  useList<MemberProfile>({
    resource: "user_profiles",
    pagination: ALL,
    queryOptions: { enabled },
  });
