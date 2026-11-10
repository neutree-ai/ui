import { Badge } from "@/components/ui/badge";
import { teamSource } from "@/domains/organization/lib/team";
import type { Team } from "@/domains/organization/types";
import { useTranslation } from "@/foundation/lib/i18n";

/** Where a Team comes from: its identity source, or "Manual". */
export function TeamSourceLabel({ team }: { team: Pick<Team, "spec"> }) {
  const { t } = useTranslation();
  const source = teamSource(team);
  if (source) {
    return (
      <span className="shrink-0 text-xs text-muted-foreground">{source}</span>
    );
  }
  return (
    <Badge
      variant="outline"
      className="shrink-0 px-1.5 py-0 text-xs font-normal"
      data-testid="team-manual-badge"
    >
      {t("organization.values.manualTeam")}
    </Badge>
  );
}
