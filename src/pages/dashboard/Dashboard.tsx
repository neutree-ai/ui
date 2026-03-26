import { useList } from "@refinedev/core";
import { HardDrive, Rocket, Server } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import GrafanaDashboard from "@/foundation/components/GrafanaDashboard";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import { getOverviewDashboardProps } from "@/foundation/lib/grafana-dashboard-configs";
import { useTranslation } from "@/foundation/lib/i18n";
import { QuickStartDialog } from "./QuickStartDialog";

type Counter = {
  count: number;
};

const COUNT_FN = "count()";

export default function Dashboard() {
  const { t } = useTranslation();
  const { grafanaUrl } = useSystemApi();
  const [quickStartOpen, setQuickStartOpen] = useState(false);

  const { data: clusterCountData, isLoading: isClusterCountLoading } =
    useList<Counter>({
      resource: "clusters",
      meta: {
        select: COUNT_FN,
      },
    });

  const { data: endpointCountData, isLoading: isEndpointCountLoading } =
    useList<Counter>({
      resource: "endpoints",
      meta: {
        select: COUNT_FN,
      },
    });

  const endpointCount = endpointCountData?.data[0].count ?? 0;
  const showQuickStart = !isEndpointCountLoading && endpointCount === 0;

  return (
    <div className="flex flex-col h-screen space-y-4">
      <h2 className="text-2xl font-bold leading-7 text-black dark:text-white sm:truncate sm:text-3xl sm:tracking-tight">
        {t("dashboard.title")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <Card data-testid="dashboard-cluster-count">
          <CardHeader>
            <CardTitle className="flex items-center">
              <HardDrive className="w-4 h-4 mr-2" />
              {t("clusters.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isClusterCountLoading ? (
              <Skeleton className="h-4 w-full" />
            ) : (
              clusterCountData?.data[0].count
            )}
          </CardContent>
        </Card>
        {showQuickStart ? (
          <Card data-testid="dashboard-quick-start">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Rocket className="w-4 h-4 mr-2" />
                {t("dashboard.quickStart")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                {t("dashboard.quickStartDescription")}
              </p>
              <Button size="sm" onClick={() => setQuickStartOpen(true)}>
                {t("quick_start.buttons.deploy")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card data-testid="dashboard-endpoint-count">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Server className="w-4 h-4 mr-2" />
                {t("endpoints.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEndpointCountLoading ? (
                <Skeleton className="h-4 w-full" />
              ) : (
                endpointCount
              )}
            </CardContent>
          </Card>
        )}
      </div>
      {grafanaUrl ? (
        <GrafanaDashboard
          {...getOverviewDashboardProps(grafanaUrl)}
          className="flex-1"
        />
      ) : (
        <div className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">
            {t("common.messages.grafanaNotConfigured")}
          </p>
        </div>
      )}
      <QuickStartDialog
        open={quickStartOpen}
        onOpenChange={setQuickStartOpen}
      />
    </div>
  );
}
