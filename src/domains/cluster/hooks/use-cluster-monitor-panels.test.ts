import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useClusterMonitorPanels } from "./use-cluster-monitor-panels";

describe("useClusterMonitorPanels", () => {
  it("returns the single overview panel", () => {
    const { result } = renderHook(() => useClusterMonitorPanels());

    expect(result.current.panels).toEqual(["overview"]);
    expect(result.current.selectedPanel).toBe("overview");
    expect(result.current.showMonitorTab).toBe(true);
    expect(result.current.showSelector).toBe(false);
  });

  it("keeps overview selected when user selects the only panel", () => {
    const { result } = renderHook(() => useClusterMonitorPanels());

    expect(result.current.selectedPanel).toBe("overview");

    act(() => {
      result.current.setSelectedPanel("overview");
    });
    expect(result.current.selectedPanel).toBe("overview");
  });
});
