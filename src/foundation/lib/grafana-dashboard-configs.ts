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

export const getClusterRayDashboardProps = (
  grafanaUrl: string,
  clusterName: string,
): GrafanaDashboardProps => ({
  dashboardConfig: {
    ...getBaseDashboardConfig(grafanaUrl),
    dashboardId: "rayDefaultDashboard",
    variables: {
      ...getCommonVariables(),
      SessionName: GRAFANA_VAR_ALL,
      Instance: GRAFANA_VAR_ALL,
      Cluster: clusterName,
    },
  },
});

export const getClusterRouterDashboardProps = (
  grafanaUrl: string,
  clusterName: string,
): GrafanaDashboardProps => ({
  dashboardConfig: {
    ...getBaseDashboardConfig(grafanaUrl),
    dashboardId: "router",
    variables: {
      ...getCommonVariables(),
      Cluster: clusterName,
    },
  },
});

export const getNodeExporterDashboardProps = (
  grafanaUrl: string,
  clusterName: string,
): GrafanaDashboardProps => ({
  dashboardConfig: {
    ...getBaseDashboardConfig(grafanaUrl),
    dashboardId: "node-exporter",
    variables: {
      ...getCommonVariables(),
      Cluster: clusterName,
    },
  },
});

export const getGpuDcgmDashboardProps = (
  grafanaUrl: string,
  clusterName: string,
): GrafanaDashboardProps => ({
  dashboardConfig: {
    ...getBaseDashboardConfig(grafanaUrl),
    dashboardId: "nvidia-dcgm-dashboard",
    variables: {
      ...getCommonVariables(),
      Cluster: clusterName,
    },
  },
});

export const getOverviewDashboardProps = (
  grafanaUrl: string,
): GrafanaDashboardProps => ({
  dashboardConfig: {
    ...getBaseDashboardConfig(grafanaUrl),
    dashboardId: "overview",
    variables: {
      ...getCommonVariables(),
      Cluster: GRAFANA_VAR_ALL,
    },
  },
});

export const getEndpointDashboardProps = (
  grafanaUrl: string,
  endpointName: string,
  clusterName: string,
  replica?: string,
): GrafanaDashboardProps => ({
  dashboardConfig: {
    ...getBaseDashboardConfig(grafanaUrl),
    dashboardId: "rayServeDeploymentDashboard",
    variables: {
      ...getCommonVariables(),
      Application: endpointName,
      Deployment: GRAFANA_VAR_ALL,
      Replica: replica || GRAFANA_VAR_ALL,
      Route: GRAFANA_VAR_ALL,
      Cluster: clusterName,
    },
  },
});

export const getVllmDashboardProps = (
  grafanaUrl: string,
  endpointName: string,
  clusterName: string,
  replica?: string,
): GrafanaDashboardProps => ({
  dashboardConfig: {
    ...getBaseDashboardConfig(grafanaUrl),
    dashboardId: "vllm",
    variables: {
      ...getCommonVariables(),
      Cluster: clusterName,
      Application: endpointName,
      Replica: replica || GRAFANA_VAR_ALL,
    },
  },
});
