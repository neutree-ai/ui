import { useTheme } from "next-themes";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { readMonitoringState } from "@/domains/external-endpoint/lib/monitoring-state";
import type { ExternalEndpoint } from "@/domains/external-endpoint/types";
import GrafanaDashboard from "@/foundation/components/GrafanaDashboard";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import { getModelRoutingDashboardProps } from "@/foundation/lib/grafana-dashboard-configs";
import { buildGrafanaDashboardUrl } from "@/foundation/lib/grafana-dashboard-url";
import { useTranslation } from "@/foundation/lib/i18n";

/**
 * The embedded dashboard and its deep link must agree on variables and time
 * range, so both come from here.
 */
function useModelRoutingDashboard(record: ExternalEndpoint) {
  const { resolvedTheme } = useTheme();
  const { grafanaUrl } = useSystemApi();
  const [params] = useSearchParams();
  // Navigation only supplies initial context. Grafana owns subsequent changes.
  const state = readMonitoringState(params);
  const props =
    grafanaUrl && record.metadata.workspace
      ? getModelRoutingDashboardProps(grafanaUrl, {
          workspace: record.metadata.workspace,
          endpoint: record.metadata.name,
          ...state,
        })
      : null;
  const link = props
    ? new URL(buildGrafanaDashboardUrl({ ...props, resolvedTheme }))
    : null;
  link?.searchParams.delete("kiosk");
  return { props, link };
}

/**
 * Deep link into Grafana proper — a debugging affordance, not the primary
 * action, so it rides in the detail page's tab row instead of a row of its own.
 */
export function ExternalEndpointMonitorLink({
  record,
}: {
  record: ExternalEndpoint;
}) {
  const { t } = useTranslation();
  const { link } = useModelRoutingDashboard(record);
  if (!link || !record.spec.model_routes?.length) return null;
  return (
    <Button variant="link" size="sm" className="h-auto p-0" asChild>
      <a href={link.toString()} target="_blank" rel="noopener noreferrer">
        {t("external_endpoints.monitor.openGrafana")}
      </a>
    </Button>
  );
}

export default function ExternalEndpointMonitor({
  record,
}: {
  record: ExternalEndpoint;
}) {
  const { t } = useTranslation();
  const { isLoading, error, refetch } = useSystemApi();
  const { props } = useModelRoutingDashboard(record);

  if (!record.spec.model_routes?.length)
    return (
      <p className="p-6 text-muted-foreground">
        {t("external_endpoints.monitor.legacy")}
      </p>
    );

  return (
    <div className="flex h-full flex-col gap-4">
      {props ? (
        <div
          role="region"
          className="min-h-0 flex-1"
          aria-label={t("external_endpoints.monitor.chartArea")}
        >
          <GrafanaDashboard
            {...props}
            dashboardConfig={{
              ...props.dashboardConfig,
              dashboardId: "neutree-model-routing-embed",
            }}
          />
        </div>
      ) : (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          {isLoading ? (
            t("external_endpoints.monitor.loading")
          ) : error ? (
            <>
              <p>{t("external_endpoints.monitor.configError")}</p>
              <Button variant="outline" onClick={() => refetch()}>
                {t("external_endpoints.monitor.retry")}
              </Button>
            </>
          ) : (
            t("common.messages.grafanaNotConfigured")
          )}
        </div>
      )}
    </div>
  );
}
