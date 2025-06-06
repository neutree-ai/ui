import GrafanaPanels from "@/components/business/GrafanaPanels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useList } from "@refinedev/core";
import { HardDrive, Server } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useSystemApi } from "@/hooks/use-system-api";

type Counter = {
  count: number;
};

const COUNT_FN = "count()";

export default function Dashboard() {
  const { t } = useTranslation();
  const { grafanaUrl } = useSystemApi();

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

  return (
    <div className="flex flex-col h-screen space-y-4">
      <h2 className="text-2xl font-bold leading-7 text-black dark:text-white sm:truncate sm:text-3xl sm:tracking-tight">
        {t("dashboard.title")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <Card>
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
        <Card>
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
              endpointCountData?.data[0].count
            )}
          </CardContent>
        </Card>
      </div>
      {grafanaUrl ? (
        <GrafanaPanels
          dashboardConfig={{
            baseUrl: grafanaUrl,
            dashboardId: "rayServeDashboard",
            orgId: 1,
            timezone: "browser",
            variables: {
              datasource: "neutree-cluster",
              Application: "$__all",
              HTTP_Route: "$__all",
              gRPC_Method: "$__all",
              Cluster: "$__all",
            },
          }}
          panels={[
            {
              id: 5,
            },
            {
              id: 7,
            },
            {
              id: 8,
            },
            {
              id: 17,
            },
            {
              id: 12,
            },
            {
              id: 15,
            },
            {
              id: 16,
            },
            {
              id: 2,
            },
            {
              id: 13,
            },
            {
              id: 14,
            },
            {
              id: 9,
            },
            {
              id: 10,
            },
            {
              id: 11,
            },
            {
              id: 3,
            },
            {
              id: 4,
            },
            {
              id: 6,
            },
            {
              id: 20,
            },
            {
              id: 21,
            },
            {
              id: 22,
            },
            {
              id: 23,
            },
            {
              id: 24,
            },
            {
              id: 25,
            },
          ]}
          enableAutoRefresh={true}
          refreshIntervals={[0, 5, 10, 30, 60, 300, 600]}
          className="w-full"
        />
      ) : (
        <div className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">
            {t("common.messages.grafanaNotConfigured")}
          </p>
        </div>
      )}
    </div>
  );
}
