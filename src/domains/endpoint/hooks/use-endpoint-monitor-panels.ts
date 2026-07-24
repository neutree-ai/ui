import { useMemo, useState } from "react";

type EndpointMonitorPanelType =
  | "overview"
  | "latency"
  | "throughput"
  | "queue"
  | "cache";

interface UseEndpointMonitorPanelsProps {
  engineType?: string;
}

/**
 * Hook for managing endpoint monitoring panels
 */
export const useEndpointMonitorPanels = ({
  engineType,
}: UseEndpointMonitorPanelsProps) => {
  const panels = useMemo(() => {
    if (!engineType) {
      return [];
    }

    if (engineType !== "vllm" && engineType !== "sglang") {
      return ["overview"] satisfies EndpointMonitorPanelType[];
    }

    return [
      "overview",
      "latency",
      "throughput",
      "queue",
      "cache",
    ] satisfies EndpointMonitorPanelType[];
  }, [engineType]);

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
