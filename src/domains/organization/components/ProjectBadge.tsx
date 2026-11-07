import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/foundation/lib/i18n";

/** Marks a Team labelled as a project. */
export function ProjectBadge() {
  const { t } = useTranslation();
  return (
    <Badge
      className="shrink-0 px-1.5 py-0 font-normal"
      data-testid="team-project-badge"
    >
      {t("organization.values.project")}
    </Badge>
  );
}
