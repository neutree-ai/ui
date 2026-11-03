import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  buildGrafanaDashboardUrl,
  type GrafanaDashboardUrlOptions,
} from "@/foundation/lib/grafana-dashboard-url";
import { useTranslation } from "@/foundation/lib/i18n";

/**
 * Opens a dashboard in Grafana proper: outside the embedded kiosk view, and
 * with its variables shown even when the embedded panel hides them.
 */
export function GrafanaDashboardLink(props: GrafanaDashboardUrlOptions) {
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const href = buildGrafanaDashboardUrl({
    ...props,
    resolvedTheme,
    hideVariables: false,
    kiosk: false,
  });
  return (
    <Button variant="link" size="sm" className="h-auto p-0" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        {t("common.monitor.openGrafana")}
      </a>
    </Button>
  );
}
