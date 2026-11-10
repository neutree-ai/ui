import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroupModelAccess } from "@/domains/group-policy/components/GroupModelAccess";
import { useSubjectQuotaColumn } from "@/domains/group-policy/hooks/use-subject-quota-column";
import type { PolicySubject } from "@/domains/group-policy/types";
import { DepartmentsPanel } from "@/domains/organization/components/DepartmentsPanel";
import type { MemberRow } from "@/domains/organization/components/MemberTable";
import { OrgUnitLabel } from "@/domains/organization/components/OrgUnitField";
import { TeamsPanel } from "@/domains/organization/components/TeamsPanel";
import { useOrganizationView } from "@/domains/organization/hooks/use-organization-view";
import { GroupRoleAssignments } from "@/domains/role-assignment/components/GroupRoleAssignments";
import { ListPage } from "@/foundation/components/ListPage";
import { useHasPermission } from "@/foundation/hooks/use-has-permission";
import { displayName } from "@/foundation/lib/display-name";
import { useTranslation } from "@/foundation/lib/i18n";
import type { LabeledScope } from "@/foundation/types/group-scope";
import { TeamDetailTabs } from "@/pages/organization/team-detail-tabs";
import { useTeamDeleteCheck } from "@/pages/organization/use-team-delete-check";

const renderOrgUnit = (name: string) => <OrgUnitLabel name={name} />;

const memberSubject = (row: MemberRow): PolicySubject => ({
  kind: "User",
  id: row.key,
  label: row.profile ? displayName(row.profile.metadata) : row.key,
});

// Each member's limits set in the selected Team or department.
const useMemberLimits = (scope: LabeledScope | undefined) =>
  useSubjectQuotaColumn(scope, memberSubject);

/**
 * Departments and teams synced from identity sources, which sync owns, and
 * teams created in Neutree, managed in the Teams tab.
 */
export const OrganizationList = () => {
  const { t } = useTranslation();
  // team:read on a Team (team admins) reads that Team; departments need
  // org_unit:read in some scope.
  const { allowed: canReadTeams } = useHasPermission("team:read");
  const { allowed: canReadDepartments } = useHasPermission("org_unit:read");
  const [view, updateView] = useOrganizationView();
  const tab =
    canReadTeams === true &&
    (view.tab === "teams" || canReadDepartments === false)
      ? "teams"
      : "departments";

  return (
    <ListPage
      canCreate={false}
      extra={
        <span className="text-sm text-muted-foreground">
          {t("organization.readOnlyHint")}
        </span>
      }
    >
      {/* Tabs stay mounted while team:read is checked, so the departments
          panel keeps its state when the Teams tab appears. */}
      <Tabs
        value={tab}
        onValueChange={(next) =>
          updateView({ tab: next === "teams" ? "teams" : "departments" })
        }
      >
        {canReadTeams && (
          <TabsList className="mb-3">
            {canReadDepartments !== false && (
              <TabsTrigger value="departments">
                {t("organization.departments.title")}
              </TabsTrigger>
            )}
            <TabsTrigger value="teams" data-testid="organization-teams-tab">
              {t("organization.teams.title")}
            </TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="departments" className="mt-0">
          <DepartmentsPanel
            useMemberColumn={useMemberLimits}
            renderRoleAssignments={(name, label) => (
              <>
                <GroupRoleAssignments
                  kind="OrgUnit"
                  name={name}
                  renderOrgUnit={renderOrgUnit}
                />
                <GroupModelAccess kind="OrgUnit" name={name} label={label} />
              </>
            )}
          />
        </TabsContent>
        {canReadTeams && (
          <TabsContent value="teams" className="mt-0">
            <TeamsPanel
              useDeleteCheck={useTeamDeleteCheck}
              useMemberColumn={useMemberLimits}
              renderTeamDetail={(team, members) => (
                <TeamDetailTabs team={team} members={members} />
              )}
              renderRoleAssignments={(name, label) => (
                <>
                  <GroupRoleAssignments
                    kind="Team"
                    name={name}
                    renderOrgUnit={renderOrgUnit}
                  />
                  <GroupModelAccess kind="Team" name={name} label={label} />
                </>
              )}
            />
          </TabsContent>
        )}
      </Tabs>
    </ListPage>
  );
};
