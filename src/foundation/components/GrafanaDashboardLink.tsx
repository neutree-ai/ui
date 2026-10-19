import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  buildGrafanaDashboardUrl,
  type GrafanaDashboardUrlOptions,
} from "@/foundation/lib/grafana-dashboard-url";
import { useTranslation } from "@/foundation/lib/i18n";

export function GrafanaDashboardLink(props: GrafanaDashboardUrlOptions) {
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const url = new URL(buildGrafanaDashboardUrl({ ...props, resolvedTheme }));
  url.searchParams.delete("kiosk");
  return (
    <Button variant="link" size="sm" className="h-auto p-0" asChild>
      <a href={url.toString()} target="_blank" rel="noopener noreferrer">
        {t("external_endpoints.monitor.openGrafana")}
      </a>
    </Button>
  );
}
