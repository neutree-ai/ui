import { useMemo, useState } from "react";

// Endpoint monitor panel types
export type EndpointMonitorPanelType = "endpoint" | "vllm";

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
    // Rule 1: If engine is vllm, always have vllm related panels (default for SSH)
    if (engineType === "vllm") {
      list.push("vllm");
    }
    // Rule 2: If cluster is ssh, always have ray related endpoint panel
    if (clusterType === "ssh") {
      list.push("endpoint");
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
