import { useCustom, useGetIdentity } from "@refinedev/core";

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
 * Like useHasPermission, but only a global grant counts (has_permission with
 * no workspace). For data whose RLS checks exactly that, such as teams: a
 * subtree grant would show the entry with nothing readable behind it.
 */
export const useHasGlobalPermission = (permission?: string): PermissionState =>
  usePermissionRpc("/rpc/has_permission", permission, { workspace: null });
