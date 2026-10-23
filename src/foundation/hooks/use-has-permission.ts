import { useCustom, useGetIdentity } from "@refinedev/core";

/**
 * Whether the signed-in user holds a global permission, asked of the same
 * `has_permission` check the server's row policies use. Without the
 * permission a list read returns no rows rather than an error, so an empty
 * list cannot tell "nothing there" from "not allowed". False until known.
 */
export const useHasPermission = (permission: string): boolean => {
  const { data: identity } = useGetIdentity<{ id: string }>();
  const userId = identity?.id;

  const { data } = useCustom({
    url: "/rpc/has_permission",
    method: "post",
    config: {
      payload: { user_uuid: userId, required_permission: permission },
    },
    queryOptions: {
      queryKey: ["has-permission", userId, permission],
      enabled: Boolean(userId),
      retry: false,
      staleTime: 60_000,
    },
    errorNotification: false,
  });

  // The RPC answers a bare JSON boolean, not a record.
  return (data?.data as unknown) === true;
};
