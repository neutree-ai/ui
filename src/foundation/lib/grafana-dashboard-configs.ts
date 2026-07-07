import type { GrafanaDashboardProps } from "@/foundation/components/GrafanaDashboard";
import type { GrafanaDashboardConfig } from "@/foundation/lib/grafana-dashboard-url";

/** Grafana template variable value that selects all options */
export const GRAFANA_VAR_ALL = "$__all";

const getBaseDashboardConfig = (
  grafanaUrl: string,
): Omit<GrafanaDashboardConfig, "dashboardId" | "variables"> => ({
  baseUrl: grafanaUrl,
  orgId: 1,
  timezone: "browser",
});

const getCommonVariables = () => ({
  datasource: "neutree-cluster",
});

export const getOverviewDashboardProps = (
  grafanaUrl: string,
): GrafanaDashboardProps => ({
  dashboardConfig: {
    ...getBaseDashboardConfig(grafanaUrl),
    dashboardId: "neutree-overview-embed",
    variables: {
      ...getCommonVariables(),
      Cluster: GRAFANA_VAR_ALL,
    },
  },
});

export type ClusterSplitDashboardType = "overview";

const CLUSTER_SPLIT_DASHBOARD_IDS: Record<ClusterSplitDashboardType, string> = {
  overview: "neutree-cluster-overview-embed",
};

export const getClusterSplitDashboardProps = (
  grafanaUrl: string,
  dashboardType: ClusterSplitDashboardType,
  clusterName: string,
): GrafanaDashboardProps => ({
  dashboardConfig: {
    ...getBaseDashboardConfig(grafanaUrl),
    dashboardId: CLUSTER_SPLIT_DASHBOARD_IDS[dashboardType],
    variables: {
      ...getCommonVariables(),
      Cluster: clusterName,
    },
  },
});

export type EndpointSplitDashboardType =
  | "overview"
  | "latency"
  | "throughput"
  | "queue"
  | "cache";

const ENDPOINT_SPLIT_DASHBOARD_IDS: Record<EndpointSplitDashboardType, string> =
  {
    overview: "neutree-endpoint-overview-embed",
    latency: "neutree-endpoint-latency-embed",
    throughput: "neutree-endpoint-token-latency-embed",
    queue: "neutree-endpoint-queue-embed",
    cache: "neutree-endpoint-cache-embed",
  };

export const getEndpointSplitDashboardProps = (
  grafanaUrl: string,
  dashboardType: EndpointSplitDashboardType,
  context: {
    clusterName: string;
    endpointName: string;
  },
): GrafanaDashboardProps => ({
  dashboardConfig: {
    ...getBaseDashboardConfig(grafanaUrl),
    dashboardId: ENDPOINT_SPLIT_DASHBOARD_IDS[dashboardType],
    variables: {
      ...getCommonVariables(),
      Cluster: context.clusterName,
      Endpoint: context.endpointName,
    },
  },
});
