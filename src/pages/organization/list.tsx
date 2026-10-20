import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroupModelAccess } from "@/domains/group-policy/components/GroupModelAccess";
import { DepartmentsPanel } from "@/domains/organization/components/DepartmentsPanel";
import { OrgUnitLabel } from "@/domains/organization/components/OrgUnitField";
import { TeamsPanel } from "@/domains/organization/components/TeamsPanel";
import { useOrganizationView } from "@/domains/organization/hooks/use-organization-view";
import { GroupRoleAssignments } from "@/domains/role-assignment/components/GroupRoleAssignments";
import { ListPage } from "@/foundation/components/ListPage";
import { useHasGlobalPermission } from "@/foundation/hooks/use-has-permission";
import { useTranslation } from "@/foundation/lib/i18n";
import { useTeamDeleteCheck } from "@/pages/organization/use-team-delete-check";

const renderOrgUnit = (name: string) => <OrgUnitLabel name={name} />;

/**
 * Departments and teams synced from identity sources, which sync owns, and
 * teams created in Neutree, managed in the Teams tab.
 */
export const OrganizationList = () => {
  const { t } = useTranslation();
  // The teams RLS accepts a global team:read only; without it the tab would
  // read empty, so it is hidden (D69).
  const { allowed: canReadTeams } = useHasGlobalPermission("team:read");
  const [view, updateView] = useOrganizationView();
  const tab = canReadTeams === true ? view.tab : "departments";

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
            <TabsTrigger value="departments">
              {t("organization.departments.title")}
            </TabsTrigger>
            <TabsTrigger value="teams" data-testid="organization-teams-tab">
              {t("organization.teams.title")}
            </TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="departments" className="mt-0">
          <DepartmentsPanel
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
