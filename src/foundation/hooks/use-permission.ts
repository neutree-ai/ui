import { useGetIdentity } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { clientPostgrest } from "@/foundation/lib/api";
import type { Database } from "@/foundation/lib/api/api-gen";

export type PermissionAction = Database["api"]["Enums"]["permission_action"];

/**
 * Asks the server whether the signed-in user holds a permission in a workspace.
 *
 * This mirrors a check the API performs anyway — it decides what to *offer*, not
 * what is allowed. An action the user cannot perform is still refused server
 * side, so a stale or failed answer here can hide a control but can never grant
 * one: `allowed` is true only when the server said so.
 */
export const useHasPermission = (
  action: PermissionAction,
  workspace?: string | null,
) => {
  const { data: identity } = useGetIdentity<{ id?: string } | null>();
  const userId = identity?.id;
  const enabled = Boolean(userId && workspace);

  const query = useQuery<boolean, Error>({
    queryKey: ["has-permission", userId ?? null, action, workspace ?? null],
    queryFn: async () => {
      const { data, error } = await clientPostgrest.rpc("has_permission", {
        user_uuid: userId as string,
        required_permission: action,
        workspace: workspace as string,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data === true;
    },
    enabled,
    // Role assignments change rarely, and re-asking on every mount would put a
    // round trip in front of every button this gates.
    staleTime: 5 * 60 * 1000,
  });

  return {
    allowed: query.data === true,
    // Until this settles the caller knows nothing; rendering a control as
    // enabled in the meantime is the one outcome to avoid.
    isLoading: enabled ? query.isLoading : false,
  };
};
