import type { ReactNode } from "react";
import { scopeOf } from "@/domains/role-assignment/lib/scope";
import type { RoleAssignmentSpec } from "@/domains/role-assignment/types";
import { ShowButton } from "@/foundation/components/ShowButton";
import { useTranslation } from "@/foundation/lib/i18n";

type RoleAssignmentScopeLabelProps = {
  spec: RoleAssignmentSpec;
  /** Renders the department; the page supplies it from the organization domain. */
  renderOrgUnit?: (name: string) => ReactNode;
};

/** "Global", "Workspace: <name>" or "Subtree: <department>". */
export function RoleAssignmentScopeLabel({
  spec,
  renderOrgUnit = (name) => name,
}: RoleAssignmentScopeLabelProps) {
  const { t } = useTranslation();
  const scope = scopeOf(spec);

  if (scope === "global") {
    return (
      <span data-testid="role-assignment-scope">
        {t("role_assignments.options.global")}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1"
      data-testid="role-assignment-scope"
    >
      {scope === "workspace" ? (
        <>
          {t("role_assignments.scope.workspace")}
          <ShowButton
            recordItemId={spec.workspace ?? ""}
            meta={{}}
            variant="link"
            resource="workspaces"
          >
            {spec.workspace}
          </ShowButton>
        </>
      ) : (
        <>
          {t("role_assignments.scope.orgUnit")}
          {renderOrgUnit(spec.org_unit ?? "")}
        </>
      )}
    </span>
  );
}
