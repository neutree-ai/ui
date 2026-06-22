import { useMemo, useState } from "react";

// Cluster monitor panel types
export type ClusterMonitorPanelType =
  | "ray"
  | "router"
  | "node"
  | "gpu"
  | "vgpu";

interface UseClusterMonitorPanelsProps {
  clusterType?: string;
  acceleratorVirtualizationEnabled?: boolean;
}

/**
 * Hook for managing cluster monitoring panels
 */
export const useClusterMonitorPanels = ({
  clusterType,
  acceleratorVirtualizationEnabled = false,
}: UseClusterMonitorPanelsProps) => {
  const panels = useMemo(() => {
    const list: ClusterMonitorPanelType[] = [];

    if (clusterType === "ssh") {
      // SSH clusters use Ray dashboard metrics
      list.push("ray");
    } else if (clusterType === "kubernetes") {
      // Kubernetes clusters have GPU, router, and node exporter monitoring
      if (acceleratorVirtualizationEnabled) {
        list.push("vgpu");
      }
      list.push("gpu");
      list.push("router");
      list.push("node");
    }

    return list;
  }, [acceleratorVirtualizationEnabled, clusterType]);

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
