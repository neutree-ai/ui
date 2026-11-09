import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/foundation/lib/i18n";

/** Marks an Inactive department, Team or group. */
export function InactiveBadge({ title }: { title?: string }) {
  const { t } = useTranslation();
  return (
    <Badge
      variant="secondary"
      className="shrink-0 px-1.5 py-0 font-normal"
      title={title}
    >
      {t("organization.phases.Inactive")}
    </Badge>
  );
}
