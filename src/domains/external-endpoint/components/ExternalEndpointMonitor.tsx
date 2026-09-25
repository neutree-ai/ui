import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { readMonitoringState } from "@/domains/external-endpoint/lib/monitoring-state";
import type { ExternalEndpoint } from "@/domains/external-endpoint/types";
import GrafanaDashboard from "@/foundation/components/GrafanaDashboard";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import { getModelRoutingDashboardProps } from "@/foundation/lib/grafana-dashboard-configs";
import { useTranslation } from "@/foundation/lib/i18n";

export default function ExternalEndpointMonitor({
  record,
  onViewConfiguration,
}: {
  record: ExternalEndpoint;
  onViewConfiguration: () => void;
}) {
  const { t } = useTranslation();
  const { grafanaUrl, isLoading, error, refetch } = useSystemApi();
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

  if (!record.spec.model_routes?.length)
    return (
      <p className="p-6 text-muted-foreground">
        {t("external_endpoints.monitor.legacy")}
      </p>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t("external_endpoints.monitor.scope")}
        </p>
        <Button variant="outline" onClick={onViewConfiguration}>
          {t("external_endpoints.monitor.viewConfig")}
        </Button>
      </div>
      {props ? (
        <div
          role="region"
          className="h-[calc(100dvh-14rem)] min-h-[480px]"
          aria-label={t("external_endpoints.monitor.chartArea")}
        >
          <GrafanaDashboard {...props} />
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
