import type {
  DashboardConfig,
  PanelConfig,
  GrafanaPanelsProps,
} from "@/components/business/GrafanaPanels";

/**
 * Grafana dashboard configurations for different views
 */

// Common configuration
const getBaseDashboardConfig = (
  grafanaUrl: string,
): Omit<DashboardConfig, "dashboardId" | "variables"> => ({
  baseUrl: grafanaUrl,
  orgId: 1,
  timezone: "browser",
});

// Common variables
const getCommonVariables = () => ({
  datasource: "neutree-cluster",
});

// Common panel props
const getCommonPanelProps = (): Partial<GrafanaPanelsProps> => ({
  enableAutoRefresh: true,
  refreshIntervals: [0, 5, 10, 30, 60, 300, 600],
  className: "w-full",
});

// Panel configurations
const DASHBOARD_PANELS: PanelConfig[] = [
  { id: 5 },
  { id: 7 },
  { id: 8 },
  { id: 17 },
  { id: 12 },
  { id: 15 },
  { id: 16 },
  { id: 2 },
  { id: 13 },
  { id: 14 },
  { id: 9 },
  { id: 10 },
  { id: 11 },
  { id: 3 },
  { id: 4 },
  { id: 6 },
  { id: 20 },
  { id: 21 },
  { id: 22 },
  { id: 23 },
  { id: 24 },
  { id: 25 },
];

const CLUSTER_PANELS: PanelConfig[] = [
  { id: 26 },
  { id: 35 },
  { id: 38 },
  { id: 33 },
  { id: 42 },
  { id: 36 },
  { id: 27 },
  { id: 29 },
  { id: 28 },
  { id: 40 },
  { id: 2 },
  { id: 8 },
  { id: 6 },
  { id: 32 },
  { id: 4 },
  { id: 48 },
  { id: 44 },
  { id: 34 },
  { id: 37 },
  { id: 18 },
  { id: 20 },
  { id: 24 },
  { id: 41 },
];

const ENDPOINT_PANELS: PanelConfig[] = [
  { id: 1 },
  { id: 2 },
  { id: 3 },
  { id: 4 },
  { id: 5 },
  { id: 6 },
  { id: 7 },
  { id: 8 },
  { id: 9 },
  { id: 10 },
  { id: 11 },
  { id: 12 },
  { id: 13 },
  { id: 14 },
  { id: 15 },
];

const VLLM_PANELS: PanelConfig[] = [
  { id: 9 },
  { id: 8 },
  { id: 3 },
  { id: 5 },
  { id: 10 },
  { id: 4 },
  { id: 12 },
  { id: 13 },
  { id: 11 },
  { id: 16 },
];

/**
 * One-stop function to get complete Grafana props for main dashboard
 */
export const getDashboardGrafanaProps = (
  grafanaUrl: string,
): GrafanaPanelsProps => ({
  dashboardConfig: {
    ...getBaseDashboardConfig(grafanaUrl),
    dashboardId: "rayServeDashboard",
    variables: {
      ...getCommonVariables(),
      Application: "$__all",
      HTTP_Route: "$__all",
      gRPC_Method: "$__all",
      Cluster: "$__all",
    },
  },
  panels: DASHBOARD_PANELS,
  ...getCommonPanelProps(),
});

/**
 * One-stop function to get complete Grafana props for cluster monitoring
 */
export const getClusterGrafanaProps = (
  grafanaUrl: string,
  clusterName: string,
): GrafanaPanelsProps => ({
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
  panels: CLUSTER_PANELS,
  ...getCommonPanelProps(),
});

/**
 * One-stop function to get complete Grafana props for endpoint monitoring
 */
export const getEndpointGrafanaProps = (
  grafanaUrl: string,
  endpointName: string,
  clusterName: string,
): GrafanaPanelsProps => ({
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
  panels: ENDPOINT_PANELS,
  ...getCommonPanelProps(),
});

/**
 * One-stop function to get complete Grafana props for vLLM engine monitoring
 */
export const getVllmGrafanaProps = (
  grafanaUrl: string,
  endpointName: string,
  clusterName: string,
): GrafanaPanelsProps => ({
  dashboardConfig: {
    ...getBaseDashboardConfig(grafanaUrl),
    dashboardId: "vllm",
    variables: {
      ...getCommonVariables(),
      Cluster: clusterName,
      Application: endpointName,
    },
  },
  panels: VLLM_PANELS,
  ...getCommonPanelProps(),
});
