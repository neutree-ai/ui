import type {
  DashboardConfig,
  GrafanaPanelsProps,
  PanelConfig,
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

const K8S_ROUTER_PANELS: PanelConfig[] = [
  { id: 1 },
  { id: 3 },
  { id: 19 },
  { id: 15 },
  { id: 16 },
  { id: 17 },
];

// Node Exporter dashboard panels (for Kubernetes cluster node monitoring)
const NODE_EXPORTER_PANELS: PanelConfig[] = [
  // Overview stats
  { id: 30 }, // CPU Utilization (Avg)
  { id: 31 }, // Total CPU Cores
  { id: 32 }, // Memory Utilization (Avg)
  { id: 33 }, // Total Memory
  // CPU
  { id: 2 }, // CPU Utilisation
  { id: 3 }, // CPU Saturation (Load1 per CPU)
  // Memory
  { id: 4 }, // Memory Utilisation
  { id: 5 }, // Memory Saturation (Major Page Faults)
  // GPU (from node-exporter dashboard)
  { id: 17 }, // GPU Utilization
  { id: 18 }, // GPU Memory Utilization
  // Network
  { id: 6 }, // Network Utilisation (Bytes Receive/Transmit)
  { id: 7 }, // Network Saturation (Drops Receive/Transmit)
  // Disk IO
  { id: 8 }, // Disk IO Utilisation
  { id: 9 }, // Disk IO Saturation
  // Disk Space
  { id: 10 }, // Disk Space Utilisation
];

// GPU (DCGM Exporter) dashboard panels
const GPU_DCGM_PANELS: PanelConfig[] = [
  // Overview stats
  { id: 20 }, // GPU Utilization
  { id: 21 }, // GPU Memory Utilization
  { id: 25 }, // GPU Memory Total
  { id: 22 }, // GPU Requests Commitment
  { id: 24 }, // Total GPUs
  { id: 23 }, // GPU Nodes
  // Detailed charts
  { id: 6 }, // GPU Utilization (timeseries)
  { id: 18 }, // GPU Memory Used
  { id: 12 }, // GPU Temperature
  { id: 19 }, // GPU Memory Used Percentage
  { id: 4 }, // Tensor Core Utilization
  { id: 2 }, // GPU SM Clocks
  // Gauges and stats
  { id: 14 }, // GPU Average Temperature
  { id: 16 }, // GPU Power Total
  { id: 10 }, // GPU Power Usage
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
 * Get Grafana props for SSH cluster Ray dashboard monitoring
 */
export const getClusterRayGrafanaProps = (
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
 * Get Grafana props for Kubernetes cluster Router monitoring
 */
export const getClusterRouterGrafanaProps = (
  grafanaUrl: string,
  clusterName: string,
): GrafanaPanelsProps => ({
  dashboardConfig: {
    ...getBaseDashboardConfig(grafanaUrl),
    dashboardId: "router",
    variables: {
      ...getCommonVariables(),
      Cluster: clusterName,
    },
  },
  panels: K8S_ROUTER_PANELS,
  ...getCommonPanelProps(),
});

/**
 * @deprecated Use getClusterRayGrafanaProps or getClusterRouterGrafanaProps instead
 */
export const getClusterGrafanaProps = (
  grafanaUrl: string,
  clusterName: string,
  clusterType: string,
): GrafanaPanelsProps => {
  if (clusterType === "kubernetes") {
    return getClusterRouterGrafanaProps(grafanaUrl, clusterName);
  }
  return getClusterRayGrafanaProps(grafanaUrl, clusterName);
};

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

/**
 * One-stop function to get complete Grafana props for Node Exporter monitoring
 * Used for Kubernetes cluster node metrics (CPU, Memory, Network, Disk)
 */
export const getNodeExporterGrafanaProps = (
  grafanaUrl: string,
  clusterName: string,
): GrafanaPanelsProps => ({
  dashboardConfig: {
    ...getBaseDashboardConfig(grafanaUrl),
    dashboardId: "node-exporter",
    variables: {
      ...getCommonVariables(),
      Cluster: clusterName,
    },
  },
  panels: NODE_EXPORTER_PANELS,
  ...getCommonPanelProps(),
});

/**
 * One-stop function to get complete Grafana props for GPU (DCGM) monitoring
 * Used for NVIDIA GPU metrics via DCGM Exporter
 */
export const getGpuDcgmGrafanaProps = (
  grafanaUrl: string,
  clusterName: string,
): GrafanaPanelsProps => ({
  dashboardConfig: {
    ...getBaseDashboardConfig(grafanaUrl),
    dashboardId: "nvidia-dcgm-dashboard",
    variables: {
      ...getCommonVariables(),
      Cluster: clusterName,
    },
  },
  panels: GPU_DCGM_PANELS,
  ...getCommonPanelProps(),
});
