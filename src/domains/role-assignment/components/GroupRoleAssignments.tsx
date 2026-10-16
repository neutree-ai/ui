import type { GroupRenderers } from "@/domains/role-assignment/components/RoleAssignmentSubjectLabel";
import { RoleAssignmentTable } from "@/domains/role-assignment/components/RoleAssignmentTable";
import { useGroupRoleAssignments } from "@/domains/role-assignment/hooks/use-role-assignments";
import { ShowPage } from "@/foundation/components/ShowPage";
import {
  useHasGlobalPermission,
  useHasPermission,
} from "@/foundation/hooks/use-has-permission";
import { getErrorMessage } from "@/foundation/lib/error-message";
import { useTranslation } from "@/foundation/lib/i18n";

/**
 * The role assignments a Team or an OrgUnit holds. A Team's are readable with
 * a global role_assignment:read only; an OrgUnit's also with a subtree grant
 * that covers it, so the section shows for any scope and RLS filters rows.
 */
export function GroupRoleAssignments({
  kind,
  name,
  renderOrgUnit,
}: {
  kind: "Team" | "OrgUnit";
  name: string;
} & Pick<GroupRenderers, "renderOrgUnit">) {
  const { t } = useTranslation();
  const { allowed: global } = useHasGlobalPermission("role_assignment:read");
  const { allowed: anyScope } = useHasPermission("role_assignment:read");
  const canRead = (kind === "Team" ? global : anyScope) === true;
  const { rows, isLoading, error } = useGroupRoleAssignments(
    kind,
    name,
    canRead,
  );

  if (!canRead) return null;

  return (
    <ShowPage.Section
      title={t("role_assignments.group.title")}
      description={t(
        kind === "Team"
          ? "role_assignments.group.hint.Team"
          : "role_assignments.group.hint.OrgUnit",
      )}
      data-testid="group-role-assignments"
    >
      <RoleAssignmentTable
        rows={rows.map((ra) => ({
          key: String(ra.id),
          name: ra.metadata.name,
          spec: ra.spec,
        }))}
        isLoading={isLoading}
        error={
          error ? getErrorMessage(error, t("common.errors.unknown")) : undefined
        }
        emptyText={t("role_assignments.group.empty")}
        renderOrgUnit={renderOrgUnit}
        data-testid="group-role-assignments-table"
      />
    </ShowPage.Section>
  );
}
