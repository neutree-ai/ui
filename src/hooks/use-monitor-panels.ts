import { useMemo, useState } from "react";

// Endpoint monitor panel types
export type EndpointMonitorPanelType = "endpoint" | "vllm";

// Cluster monitor panel types
export type ClusterMonitorPanelType = "ray" | "router" | "node" | "gpu";

interface UseEndpointMonitorPanelsProps {
  clusterType?: string;
  engineType?: string;
}

/**
 * Hook for managing endpoint monitoring panels
 */
export const useEndpointMonitorPanels = ({
  clusterType,
  engineType,
}: UseEndpointMonitorPanelsProps) => {
  const panels = useMemo(() => {
    const list: EndpointMonitorPanelType[] = [];
    // Rule 1: If cluster is ssh, always have ray related endpoint panel
    if (clusterType === "ssh") {
      list.push("endpoint");
    }
    // Rule 2: If engine is vllm, always have vllm related panels
    if (engineType === "vllm") {
      list.push("vllm");
    }
    return list;
  }, [clusterType, engineType]);

  const [userSelectedPanel, setUserSelectedPanel] =
    useState<EndpointMonitorPanelType | null>(null);

  const selectedPanel = useMemo(() => {
    if (userSelectedPanel && panels.includes(userSelectedPanel)) {
      return userSelectedPanel;
    }
    return panels.length > 0 ? panels[0] : null;
  }, [panels, userSelectedPanel]);

  return {
    panels,
    selectedPanel,
    setSelectedPanel: setUserSelectedPanel,
    showMonitorTab: panels.length > 0,
    showSelector: panels.length > 1,
  };
};

interface UseClusterMonitorPanelsProps {
  clusterType?: string;
}

/**
 * Hook for managing cluster monitoring panels
 */
export const useClusterMonitorPanels = ({
  clusterType,
}: UseClusterMonitorPanelsProps) => {
  const panels = useMemo(() => {
    const list: ClusterMonitorPanelType[] = [];

    if (clusterType === "ssh") {
      // SSH clusters use Ray dashboard metrics
      list.push("ray");
    } else if (clusterType === "kubernetes") {
      // Kubernetes clusters have router, node exporter, and GPU monitoring
      list.push("router");
      list.push("node");
      list.push("gpu");
    }

    return list;
  }, [clusterType]);

  const [userSelectedPanel, setUserSelectedPanel] =
    useState<ClusterMonitorPanelType | null>(null);

  const selectedPanel = useMemo(() => {
    if (userSelectedPanel && panels.includes(userSelectedPanel)) {
      return userSelectedPanel;
    }
    return panels.length > 0 ? panels[0] : null;
  }, [panels, userSelectedPanel]);

  return {
    panels,
    selectedPanel,
    setSelectedPanel: setUserSelectedPanel,
    showMonitorTab: panels.length > 0,
    showSelector: panels.length > 1,
  };
};

/**
 * @deprecated Use useEndpointMonitorPanels instead
 */
export const useMonitorPanels = useEndpointMonitorPanels;

/**
 * @deprecated Use EndpointMonitorPanelType instead
 */
export type MonitorPanelType = EndpointMonitorPanelType;
