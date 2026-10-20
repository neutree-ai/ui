import { useGroupPolicy } from "@/domains/group-policy/hooks/use-group-policies";
import type { TeamDeleteCheck } from "@/domains/organization/types";
import { useGroupRoleAssignments } from "@/domains/role-assignment/hooks/use-role-assignments";
import { useHasGlobalPermission } from "@/foundation/hooks/use-has-permission";

/**
 * What blocks deleting a Team, read when the delete dialog opens. A caller
 * who cannot read the role assignments gets no block; the server still
 * refuses the delete (10295).
 */
export const useTeamDeleteCheck = (
  teamName: string,
  enabled: boolean,
): TeamDeleteCheck => {
  const readAssignments =
    useHasGlobalPermission("role_assignment:read").allowed === true;
  const readPolicies =
    useHasGlobalPermission("group_policy:read").allowed === true;
  const on = enabled && teamName !== "";
  const assignments = useGroupRoleAssignments(
    "Team",
    teamName,
    on && readAssignments,
  );
  const policy = useGroupPolicy("Team", teamName, on && readPolicies);
  return {
    // The server ignores assignments being deleted, and so does the check.
    roleAssignments: assignments.rows.filter(
      (ra) => !ra.metadata.deletion_timestamp,
    ).length,
    hasPolicy: !!policy.policy,
    isLoading: assignments.isLoading || policy.isLoading,
  };
};
