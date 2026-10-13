import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DepartmentsPanel } from "@/domains/organization/components/DepartmentsPanel";
import { TeamsPanel } from "@/domains/organization/components/TeamsPanel";
import { ListPage } from "@/foundation/components/ListPage";
import { useHasPermission } from "@/foundation/hooks/use-has-permission";
import { useTranslation } from "@/foundation/lib/i18n";

/**
 * Departments and teams synced from identity sources. Read-only: sync owns
 * them, so there is nothing to create or edit here.
 */
export const OrganizationList = () => {
  const { t } = useTranslation();
  // Without team:read the teams table reads empty; hide it instead (D69).
  const { allowed: canReadTeams } = useHasPermission("team:read");

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
      <Tabs defaultValue="departments">
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
          <DepartmentsPanel />
        </TabsContent>
        {canReadTeams && (
          <TabsContent value="teams" className="mt-0">
            <TeamsPanel />
          </TabsContent>
        )}
      </Tabs>
    </ListPage>
  );
};
