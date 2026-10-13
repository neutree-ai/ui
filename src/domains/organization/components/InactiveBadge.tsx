import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/foundation/lib/i18n";

export function InactiveBadge() {
  const { t } = useTranslation();
  return (
    <Badge variant="secondary" className="shrink-0 px-1.5 py-0 font-normal">
      {t("organization.phases.Inactive")}
    </Badge>
  );
}
