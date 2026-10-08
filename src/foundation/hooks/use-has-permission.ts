import { useCustom, useGetIdentity } from "@refinedev/core";

type PermissionState = {
  /** Undefined while it is still being checked. */
  allowed: boolean | undefined;
  isLoading: boolean;
};

/**
 * Whether the signed-in user holds a global permission (e.g.
 * "identity_source:read"), as the database's has_permission decides it.
 * Without a permission to check, everything is allowed.
 *
 * This only decides what the UI offers; the server enforces it regardless.
 */
export const useHasPermission = (permission?: string): PermissionState => {
  const { data: identity, isLoading: identityLoading } = useGetIdentity<{
    id?: string;
  }>();
  const userId = identity?.id;

  // has_permission answers with a bare boolean, read back through `unknown`.
  const { data, isLoading, isError } = useCustom({
    url: "/rpc/has_permission",
    method: "post",
    config: {
      payload: { user_uuid: userId, required_permission: permission },
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
