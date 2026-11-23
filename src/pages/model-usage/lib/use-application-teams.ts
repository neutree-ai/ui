import { useMemo } from "react";
import { useTeams } from "@/domains/organization/hooks/use-organization";
import { isProjectTeam } from "@/domains/organization/lib/team";
import { useAllServiceAccounts } from "@/domains/service-account/hooks/use-service-accounts";
import { useTranslation } from "@/foundation/lib/i18n";
import { displayName } from "@/foundation/role/display-name";

/**
 * What each application belongs to, by application id: "Team · name" or
 * "Scenario · name". Two list reads serve every row, however many there are.
 * An application whose Team the caller cannot read is absent.
 */
export function useApplicationTeams(enabled: boolean) {
  const { t } = useTranslation();
  const accounts = useAllServiceAccounts(enabled);
  const teams = useTeams(enabled);
  const accountRows = accounts.data?.data;
  const teamRows = teams.data?.data;
  return useMemo(() => {
    const byTeamId = new Map(
      (teamRows ?? []).map((team) => [
        team.id,
        t(
          isProjectTeam(team)
            ? "model_usage.applicationOf.project"
            : "model_usage.applicationOf.team",
          { name: displayName(team.metadata) },
        ),
      ]),
    );
    const labels = new Map<string, string>();
    for (const account of accountRows ?? []) {
      const label = byTeamId.get(account.team_id);
      if (label) labels.set(account.id, label);
    }
    return labels as ReadonlyMap<string, string>;
  }, [accountRows, teamRows, t]);
}
