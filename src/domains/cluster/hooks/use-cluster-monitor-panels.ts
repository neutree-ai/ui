import { useState } from "react";

type ClusterMonitorPanelType = "overview" | "cache";

export const useClusterMonitorPanels = (cacheAvailable = false) => {
  const [selection, setSelectedPanel] =
    useState<ClusterMonitorPanelType>("overview");
  const panels: ClusterMonitorPanelType[] = cacheAvailable
    ? ["overview", "cache"]
    : ["overview"];
  return {
    panels,
    selectedPanel: cacheAvailable ? selection : ("overview" as const),
    setSelectedPanel,
    showMonitorTab: true,
    showSelector: cacheAvailable,
  };
};
