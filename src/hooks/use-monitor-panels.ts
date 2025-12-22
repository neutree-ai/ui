import { useEffect, useMemo, useState } from "react";

export type MonitorPanelType = "endpoint" | "vllm";

interface UseMonitorPanelsProps {
  clusterType?: string;
  engineType?: string;
}

export const useMonitorPanels = ({
  clusterType,
  engineType,
}: UseMonitorPanelsProps) => {
  const panels = useMemo(() => {
    const list: MonitorPanelType[] = [];
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
    useState<MonitorPanelType | null>(null);

  // Determine the effective selected panel
  // If user has selected one and it's still valid, use it.
  // Otherwise default to the first available panel.
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
