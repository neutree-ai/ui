import { type ReactNode, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamApiKeys } from "@/domains/api-key/components/TeamApiKeys";
import { TeamUsage } from "@/domains/api-key/components/TeamUsage";
import { TeamTokenPool } from "@/domains/group-policy/components/TeamTokenPool";
import { displayName } from "@/domains/organization/lib/org-tree";
import type { Team } from "@/domains/organization/types";
import { useHasTeamPermission } from "@/foundation/hooks/use-has-permission";
import { useTranslation } from "@/foundation/lib/i18n";

type TeamTab = "members" | "api-keys" | "usage";

/** A Team's members, API keys and usage, each tab shown to whoever may read it. */
export function TeamDetailTabs({
  team,
  members,
}: {
  team: Team;
  members: ReactNode;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TeamTab>("members");
  const canReadKeys =
    useHasTeamPermission("team_api_key:read", team.id).allowed === true;
  const canCreateKeys =
    useHasTeamPermission("team_api_key:create", team.id).allowed === true;
  const canUpdateKeys =
    useHasTeamPermission("team_api_key:update", team.id).allowed === true;
  const canDeleteKeys =
    useHasTeamPermission("team_api_key:delete", team.id).allowed === true;
  const canReadUsage =
    useHasTeamPermission("team_usage:read", team.id).allowed === true;

  const current =
    (tab === "api-keys" && !canReadKeys) || (tab === "usage" && !canReadUsage)
      ? "members"
      : tab;

  if (!canReadKeys && !canReadUsage) return <>{members}</>;

  return (
    <Tabs value={current} onValueChange={(next) => setTab(next as TeamTab)}>
      <TabsList className="mb-3">
        <TabsTrigger value="members" data-testid="team-tab-members">
          {t("organization.members.title")}
        </TabsTrigger>
        {canReadKeys && (
          <TabsTrigger value="api-keys" data-testid="team-tab-api-keys">
            {t("api_keys.team.tab")}
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
      {canReadKeys && (
        <TabsContent value="api-keys" className="mt-0">
          <TeamApiKeys
            teamId={team.id}
            teamName={displayName(team.metadata)}
            canCreate={canCreateKeys}
            canUpdate={canUpdateKeys}
            canDelete={canDeleteKeys}
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
