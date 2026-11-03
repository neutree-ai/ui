import { useState } from "react";
import { type Cluster, hasZCache } from "../types";

type ClusterMonitorPanelType = "overview" | "cache";

const PANELS: ClusterMonitorPanelType[] = ["overview"];
const PANELS_WITH_CACHE: ClusterMonitorPanelType[] = ["overview", "cache"];

/** The cache panel is offered only on a cluster that runs ZCache. */
export const useClusterMonitorPanels = (cluster?: Cluster) => {
  const [selection, setSelectedPanel] =
    useState<ClusterMonitorPanelType>("overview");
  const cacheAvailable = hasZCache(cluster);
  return {
    panels: cacheAvailable ? PANELS_WITH_CACHE : PANELS,
    selectedPanel: cacheAvailable ? selection : ("overview" as const),
    setSelectedPanel,
    showMonitorTab: true,
    showSelector: cacheAvailable,
  };
};
