import { useCustom, useList } from "@refinedev/core";
import type {
  EffectiveRoleAssignment,
  RoleAssignment,
} from "@/domains/role-assignment/types";
import { isPermissionDenied } from "@/foundation/lib/api-error-code";

/** The assignments a Team or an OrgUnit holds, as the caller's RLS allows. */
export const useGroupRoleAssignments = (
  kind: "Team" | "OrgUnit",
  name: string,
  enabled: boolean,
) => {
  const query = useList<RoleAssignment>({
    resource: "role_assignments",
    pagination: { mode: "off" },
    filters: [
      { field: "spec->>subject_kind", operator: "eq", value: kind },
      { field: "spec->>subject_name", operator: "eq", value: name },
    ],
    sorters: [{ field: "metadata->name", order: "asc" }],
    queryOptions: { enabled: enabled && name !== "" },
  });
  return {
    rows: query.data?.data ?? [],
    isLoading: enabled && query.isLoading,
    error: query.error,
  };
};

/**
 * The assignments that apply to a user, each with the group it comes
 * through. `denied` when the caller lacks role_assignment:read on the user.
 */
export const useUserEffectiveRoleAssignments = (
  userId: string,
  enabled: boolean,
) => {
  const query = useCustom<EffectiveRoleAssignment[]>({
    url: "/rpc/get_user_effective_role_assignments",
    method: "post",
    config: { payload: { p_user_id: userId } },
    queryOptions: { enabled, retry: false },
    successNotification: false,
    errorNotification: false,
  });
  const denied = isPermissionDenied(query.error);
  return {
    rows: (query.data?.data ?? []) as EffectiveRoleAssignment[],
    isLoading: enabled && query.isLoading,
    denied,
    error: denied ? null : query.error,
  };
};
