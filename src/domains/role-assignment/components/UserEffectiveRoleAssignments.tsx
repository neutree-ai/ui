import {
  type GroupRenderers,
  SubjectKindIcon,
} from "@/domains/role-assignment/components/RoleAssignmentSubjectLabel";
import { RoleAssignmentTable } from "@/domains/role-assignment/components/RoleAssignmentTable";
import { useUserEffectiveRoleAssignments } from "@/domains/role-assignment/hooks/use-role-assignments";
import type { EffectiveRoleAssignment } from "@/domains/role-assignment/types";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useHasPermission } from "@/foundation/hooks/use-has-permission";
import { getErrorMessage } from "@/foundation/lib/error-message";
import { useTranslation } from "@/foundation/lib/i18n";

/**
 * Every role assignment that applies to the user, with where it comes from:
 * the user's own, a Team, or a department on the user's path. Hidden when the
 * server refuses (no role_assignment:read on the user).
 */
export function UserEffectiveRoleAssignments({
  userId,
  renderTeam = (name) => name,
  renderOrgUnit = (name) => name,
}: { userId: string } & GroupRenderers) {
  const { t } = useTranslation();
  const { allowed } = useHasPermission("role_assignment:read");
  const { rows, isLoading, denied, error } = useUserEffectiveRoleAssignments(
    userId,
    allowed === true,
  );

  if (allowed !== true || denied) return null;

  const source = (row: EffectiveRoleAssignment) => (
    <span
      className="inline-flex items-center gap-1.5"
      data-testid={`effective-source-${row.id}`}
    >
      <SubjectKindIcon kind={row.via_kind} />
      {row.via_kind === "User"
        ? t("role_assignments.effective.direct")
        : row.via_kind === "Team"
          ? renderTeam(row.via_name ?? "")
          : renderOrgUnit(row.via_name ?? "")}
    </span>
  );

  return (
    <ShowPage.Section
      title={t("user_profiles.sections.effectiveRoles")}
      description={t("role_assignments.effective.hint")}
      data-testid="user-effective-roles-card"
    >
      <RoleAssignmentTable
        rows={rows.map((row) => ({
          key: String(row.id),
          name: row.name,
          spec: row.spec,
          source: source(row),
        }))}
        isLoading={isLoading}
        error={
          error ? getErrorMessage(error, t("common.errors.unknown")) : undefined
        }
        emptyText={t("role_assignments.effective.empty")}
        sourceHeader={t("role_assignments.effective.source")}
        renderOrgUnit={renderOrgUnit}
        data-testid="user-effective-roles"
      />
    </ShowPage.Section>
  );
}
