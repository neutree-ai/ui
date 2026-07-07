import { useMemo, useState } from "react";

// Cluster monitor panel types
type ClusterMonitorPanelType = "overview";

const CLUSTER_MONITOR_PANELS = ["overview"] satisfies ClusterMonitorPanelType[];

/**
 * Hook for managing cluster monitoring panels
 */
export const useClusterMonitorPanels = () => {
  const [userSelectedPanel, setUserSelectedPanel] =
    useState<ClusterMonitorPanelType | null>(null);

  const selectedPanel = useMemo(() => {
    if (
      userSelectedPanel &&
      CLUSTER_MONITOR_PANELS.includes(userSelectedPanel)
    ) {
      return userSelectedPanel;
    }
    return CLUSTER_MONITOR_PANELS[0];
  }, [userSelectedPanel]);

  return {
    panels: CLUSTER_MONITOR_PANELS,
    selectedPanel,
    setSelectedPanel: setUserSelectedPanel,
    showMonitorTab: true,
    showSelector: false,
  };
};
