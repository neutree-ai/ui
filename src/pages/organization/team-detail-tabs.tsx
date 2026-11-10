import { type ReactNode, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceAccountApiKeys } from "@/domains/api-key/components/ServiceAccountApiKeys";
import {
  ServiceAccountUsage,
  TeamUsage,
} from "@/domains/api-key/components/TeamUsage";
import { TeamTokenPool } from "@/domains/group-policy/components/TeamTokenPool";
import { useSubjectQuotaColumn } from "@/domains/group-policy/hooks/use-subject-quota-column";
import { teamScope } from "@/domains/organization/lib/team";
import type { Team } from "@/domains/organization/types";
import { TeamServiceAccounts } from "@/domains/service-account/components/TeamServiceAccounts";
import type { ServiceAccount } from "@/domains/service-account/types";
import {
  useHasGlobalPermission,
  useHasTeamPermission,
} from "@/foundation/hooks/use-has-permission";
import { displayName } from "@/foundation/lib/display-name";
import { useTranslation } from "@/foundation/lib/i18n";

type TeamTab = "members" | "applications" | "usage";

const appSubject = (account: ServiceAccount) => ({
  kind: "ServiceAccount" as const,
  id: account.id,
  label: displayName(account.metadata),
});

/** A Team's members, applications and usage, each tab shown to whoever may read it. */
export function TeamDetailTabs({
  team,
  members,
}: {
  team: Team;
  members: ReactNode;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TeamTab>("members");
  const canRead =
    useHasTeamPermission("service_account:read", team.id).allowed === true;
  const canCreate =
    useHasTeamPermission("service_account:create", team.id).allowed === true;
  const canUpdate =
    useHasTeamPermission("service_account:update", team.id).allowed === true;
  const canDelete =
    useHasTeamPermission("service_account:delete", team.id).allowed === true;
  const canReadUsage =
    useHasTeamPermission("team_usage:read", team.id).allowed === true;
  const canEditAppPermissions =
    useHasGlobalPermission("role_assignment:create").allowed === true;
  const limits = useSubjectQuotaColumn(teamScope(team), appSubject);

  const current =
    (tab === "applications" && !canRead) || (tab === "usage" && !canReadUsage)
      ? "members"
      : tab;

  if (!canRead && !canReadUsage) return <>{members}</>;

  return (
    <Tabs value={current} onValueChange={(next) => setTab(next as TeamTab)}>
      <TabsList className="mb-3">
        <TabsTrigger value="members" data-testid="team-tab-members">
          {t("organization.members.title")}
        </TabsTrigger>
        {canRead && (
          <TabsTrigger value="applications" data-testid="team-tab-applications">
            {t("service_accounts.tab")}
          </TabsTrigger>
        )}
        {canReadUsage && (
          <TabsTrigger value="usage" data-testid="team-tab-usage">
            {t("api_keys.team.usageTab")}
          </TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="members" className="mt-0">
        {members}
      </TabsContent>
      {canRead && (
        <TabsContent value="applications" className="mt-0">
          <TeamServiceAccounts
            key={team.id}
            teamId={team.id}
            teamName={displayName(team.metadata)}
            permissions={{
              canCreate,
              canUpdate,
              canDelete,
              canEditAppPermissions,
            }}
            renderKeys={(account) => (
              <ServiceAccountApiKeys
                serviceAccountId={account.id}
                serviceAccountName={displayName(account.metadata)}
                canCreate={canCreate && !account.spec?.disabled}
                canUpdate={canUpdate}
                canDelete={canDelete}
              />
            )}
            extraColumn={limits}
            // Usage by application needs team_usage:read on the Team.
            renderUsage={(account) =>
              canReadUsage ? (
                <ServiceAccountUsage
                  teamName={team.metadata.name}
                  serviceAccountId={account.id}
                />
              ) : null
            }
          />
        </TabsContent>
      )}
      {canReadUsage && (
        <TabsContent value="usage" className="mt-0 space-y-3">
          <TeamTokenPool teamName={team.metadata.name} />
          <TeamUsage teamName={team.metadata.name} />
        </TabsContent>
      )}
    </Tabs>
  );
}
