import { useCustom, useDataProvider, useGetIdentity } from "@refinedev/core";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

type PermissionState = {
  /** Undefined while it is still being checked. */
  allowed: boolean | undefined;
  isLoading: boolean;
};

const usePermissionRpc = (
  url: string,
  permission: string | undefined,
  extraPayload: Record<string, unknown> = {},
): PermissionState => {
  const { data: identity, isLoading: identityLoading } = useGetIdentity<{
    id?: string;
  }>();
  const userId = identity?.id;

  // The RPC answers with a bare boolean, read back through `unknown`.
  const { data, isLoading, isError } = useCustom({
    url,
    method: "post",
    config: {
      payload: {
        user_uuid: userId,
        required_permission: permission,
        ...extraPayload,
      },
    },
    queryOptions: {
      enabled: !!permission && !!userId,
      retry: false,
      staleTime: 60_000,
    },
    successNotification: false,
    errorNotification: false,
  });

  if (!permission) {
    return { allowed: true, isLoading: false };
  }
  if (identityLoading || (!!userId && isLoading)) {
    return { allowed: undefined, isLoading: true };
  }
  if (!userId || isError) {
    return { allowed: false, isLoading: false };
  }
  return { allowed: (data?.data as unknown) === true, isLoading: false };
};

/**
 * Whether the signed-in user holds a permission (e.g. "org_unit:read") on any
 * scope: globally or through an OrgUnit-scoped role assignment, as the
 * database's has_permission_in_any_scope decides it. Without a permission to
 * check, everything is allowed.
 *
 * Only for what the UI offers (menus, gates, buttons): a department admin
 * must see the entry even though they hold the permission on a subtree only.
 * The server checks every row regardless.
 */
export const useHasPermission = (permission?: string): PermissionState =>
  usePermissionRpc("/rpc/has_permission_in_any_scope", permission);

/**
 * Like useHasPermission, for any one of several permissions: allowed as soon
 * as one is held. A single permission, or none, behaves as useHasPermission.
 */
export const useHasAnyPermission = (
  permissions?: string | readonly string[],
): PermissionState => {
  const list =
    permissions === undefined
      ? []
      : typeof permissions === "string"
        ? [permissions]
        : permissions;
  const { data: identity, isLoading: identityLoading } = useGetIdentity<{
    id?: string;
  }>();
  const userId = identity?.id;
  const dataProvider = useDataProvider();
  const results = useQueries({
    queries: list.map((permission) => ({
      queryKey: ["has_permission_in_any_scope", userId, permission],
      queryFn: async () => {
        // biome-ignore lint/style/noNonNullAssertion: the data provider defines custom
        const { data } = await dataProvider().custom!({
          url: "/rpc/has_permission_in_any_scope",
          method: "post",
          payload: { user_uuid: userId, required_permission: permission },
        });
        return (data as unknown) === true;
      },
      enabled: !!userId,
      retry: false,
      staleTime: 60_000,
    })),
  });

  if (!list.length) return { allowed: true, isLoading: false };
  if (results.some((result) => result.data === true)) {
    return { allowed: true, isLoading: false };
  }
  if (identityLoading || (!!userId && results.some((r) => r.isLoading))) {
    return { allowed: undefined, isLoading: true };
  }
  return { allowed: false, isLoading: false };
};

/**
 * Like useHasPermission, but only a global grant counts (has_permission with
 * no workspace). For data whose RLS checks exactly that, such as teams: a
 * subtree grant would show the entry with nothing readable behind it.
 */
export const useHasGlobalPermission = (permission?: string): PermissionState =>
  usePermissionRpc("/rpc/has_permission", permission, { workspace: null });

/**
 * Whether the signed-in user holds a permission on one Team, through a global
 * or a Team-scoped role assignment (has_permission_on_team). Undefined teamId
 * skips the check and reports not allowed.
 */
export const useHasTeamPermission = (
  permission: string,
  teamId: number | undefined,
): PermissionState => {
  const state = usePermissionRpc(
    "/rpc/has_permission_on_team",
    teamId === undefined ? undefined : permission,
    { team_id: teamId },
  );
  return teamId === undefined ? { allowed: false, isLoading: false } : state;
};

const NO_TEAMS = new Set<number>();

/**
 * The ids among `teamIds` of the Teams on which the signed-in user holds a
 * permission, as useHasTeamPermission decides it for each. Empty until known.
 */
export const useTeamsWithPermission = (
  permission: string,
  teamIds: readonly number[],
  enabled = true,
): ReadonlySet<number> => {
  const { data: identity } = useGetIdentity<{ id?: string }>();
  const userId = identity?.id;
  const dataProvider = useDataProvider();
  const results = useQueries({
    queries: teamIds.map((teamId) => ({
      queryKey: ["has_permission_on_team", userId, permission, teamId],
      queryFn: async () => {
        // biome-ignore lint/style/noNonNullAssertion: the data provider defines custom
        const { data } = await dataProvider().custom!({
          url: "/rpc/has_permission_on_team",
          method: "post",
          payload: {
            user_uuid: userId,
            required_permission: permission,
            team_id: teamId,
          },
        });
        return (data as unknown) === true;
      },
      enabled: enabled && !!userId,
      retry: false,
      staleTime: 60_000,
    })),
  });
  const allowed = teamIds.filter((_, i) => results[i]?.data === true);
  const key = allowed.join(",");
  // A stable set while the answer holds, so callers can memo on it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by its ids
  return useMemo(() => (key ? new Set(allowed) : NO_TEAMS), [key]);
};
