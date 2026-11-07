import {
  useCustom,
  useCustomMutation,
  useInvalidate,
  useList,
} from "@refinedev/core";
import { withProjectLabel } from "@/domains/organization/lib/team";
import type {
  MemberProfile,
  OrgUnit,
  OrgUnitMember,
  Team,
  TeamFormValues,
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

export const useTeams = (enabled = true) =>
  useList<Team>({
    resource: "teams",
    pagination: ALL,
    queryOptions: { enabled },
  });

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

export const useAssignOrgUnit = (userId: string) => {
  const { mutateAsync, isLoading } = useCustomMutation();
  const invalidate = useInvalidate();
  const url = `/org_unit_members?user_id=eq.${encodeURIComponent(userId)}`;

  const run = async (
    method: "post" | "patch" | "delete",
    values: Record<string, unknown>,
  ) => {
    const { data } = await mutateAsync({
      url: method === "post" ? "/org_unit_members" : url,
      method,
      values,
      meta:
        method === "post"
          ? undefined
          : { headers: { Prefer: "return=representation" } },
      successNotification: false,
      errorNotification: false,
    });
    if (method !== "post" && Array.isArray(data) && data.length === 0) {
      throw new MembershipOutOfScopeError();
    }
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

const RETURN_ROWS = { headers: { Prefer: "return=representation" } };

const useTeamWrite = () => {
  const { mutateAsync, isLoading } = useCustomMutation();
  const invalidate = useInvalidate();

  const run = async (
    url: string,
    method: "post" | "patch" | "delete",
    values: unknown,
    target: "team" | "member",
  ) => {
    const { data } = await mutateAsync({
      url,
      method,
      values: values as Record<string, unknown>,
      meta: RETURN_ROWS,
      successNotification: false,
      errorNotification: false,
    });
    if (method !== "post" && Array.isArray(data) && data.length === 0) {
      throw new TeamWriteNoRowError(target);
    }
    await Promise.all(
      ["teams", "team_members"].map((resource) =>
        invalidate({ resource, invalidates: ["list"] }),
      ),
    );
    return data as unknown[] | null;
  };
  return { run, isPending: isLoading };
};

/** Create, edit and delete manual Teams. Synced Teams are read-only. */
export const useTeamWrites = () => {
  const { run, isPending } = useTeamWrite();
  const byId = (id: number) => `/teams?id=eq.${id}`;

  return {
    create: async (values: TeamFormValues) => {
      const rows = await run(
        "/teams",
        "post",
        {
          api_version: "v1",
          kind: "Team",
          metadata: {
            name: values.name,
            display_name: values.displayName,
            labels: withProjectLabel(undefined, values.project),
          },
          spec: { identity_source: null, external_id: null },
        },
        "team",
      );
      return (rows?.[0] as Team | undefined) ?? undefined;
    },
    // The whole metadata goes back: PATCH of a composite column nulls the
    // fields it leaves out.
    update: (team: Team, values: Omit<TeamFormValues, "name">) =>
      run(
        byId(team.id),
        "patch",
        {
          metadata: {
            ...team.metadata,
            display_name: values.displayName,
            labels: withProjectLabel(team.metadata.labels, values.project),
          },
        },
        "team",
      ),
    remove: (team: Team) => run(byId(team.id), "delete", undefined, "team"),
    isPending,
  };
};

/** Add or remove members of a manual Team. */
export const useTeamMemberWrites = (teamId: number | undefined) => {
  const { run, isPending } = useTeamWrite();

  return {
    add: (userIds: string[]) =>
      run(
        "/team_members",
        "post",
        userIds.map((userId) => ({ team_id: teamId, user_id: userId })),
        "member",
      ),
    remove: (userId: string) =>
      run(
        `/team_members?team_id=eq.${teamId}&user_id=eq.${encodeURIComponent(userId)}`,
        "delete",
        undefined,
        "member",
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
