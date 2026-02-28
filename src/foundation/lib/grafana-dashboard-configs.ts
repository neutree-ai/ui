import type {
  GrafanaDashboardConfig,
  GrafanaDashboardProps,
} from "@/foundation/components/GrafanaDashboard";

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
      SessionName: "$__all",
      Instance: "$__all",
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
      Cluster: "$__all",
    },
  },
});

export const getEndpointDashboardProps = (
  grafanaUrl: string,
  endpointName: string,
  clusterName: string,
): GrafanaDashboardProps => ({
  dashboardConfig: {
    ...getBaseDashboardConfig(grafanaUrl),
    dashboardId: "rayServeDeploymentDashboard",
    variables: {
      ...getCommonVariables(),
      Application: endpointName,
      Deployment: "$__all",
      Replica: "$__all",
      Route: "$__all",
      Cluster: clusterName,
    },
  },
});

export const getVllmDashboardProps = (
  grafanaUrl: string,
  endpointName: string,
  clusterName: string,
): GrafanaDashboardProps => ({
  dashboardConfig: {
    ...getBaseDashboardConfig(grafanaUrl),
    dashboardId: "vllm",
    variables: {
      ...getCommonVariables(),
      Cluster: clusterName,
      Application: endpointName,
    },
  },
});
