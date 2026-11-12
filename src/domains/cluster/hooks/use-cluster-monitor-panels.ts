import { useState } from "react";
import { type Cluster, hasZCache } from "../types";

type ClusterMonitorPanelType = "overview" | "routing" | "cache";

export const useClusterMonitorPanels = (cluster?: Cluster) => {
  const [selection, setSelectedPanel] =
    useState<ClusterMonitorPanelType>("overview");
  const cacheAvailable = hasZCache(cluster);
  const panels: ClusterMonitorPanelType[] = [
    "overview",
    ...(cluster?.spec.type === "kubernetes" ? (["routing"] as const) : []),
    ...(cacheAvailable ? (["cache"] as const) : []),
  ];
  return {
    panels,
    selectedPanel: panels.includes(selection)
      ? selection
      : ("overview" as const),
    setSelectedPanel,
    showMonitorTab: true,
    showSelector: panels.length > 1,
  };
};
