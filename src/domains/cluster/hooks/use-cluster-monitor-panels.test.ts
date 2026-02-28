import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useClusterMonitorPanels } from "./use-cluster-monitor-panels";

describe("useClusterMonitorPanels", () => {
  it("should return empty panels when no cluster type", () => {
    const { result } = renderHook(() => useClusterMonitorPanels({}));

    expect(result.current.panels).toEqual([]);
    expect(result.current.selectedPanel).toBeNull();
    expect(result.current.showMonitorTab).toBe(false);
    expect(result.current.showSelector).toBe(false);
  });

  it("should return ray panel for ssh cluster", () => {
    const { result } = renderHook(() =>
      useClusterMonitorPanels({ clusterType: "ssh" }),
    );

    expect(result.current.panels).toEqual(["ray"]);
    expect(result.current.selectedPanel).toBe("ray");
    expect(result.current.showMonitorTab).toBe(true);
    expect(result.current.showSelector).toBe(false);
  });

  it("should return router, node, gpu panels for kubernetes cluster", () => {
    const { result } = renderHook(() =>
      useClusterMonitorPanels({ clusterType: "kubernetes" }),
    );

    expect(result.current.panels).toEqual(["gpu", "router", "node"]);
    expect(result.current.selectedPanel).toBe("gpu");
    expect(result.current.showMonitorTab).toBe(true);
    expect(result.current.showSelector).toBe(true);
  });

  it("should allow user to select panel for kubernetes cluster", () => {
    const { result } = renderHook(() =>
      useClusterMonitorPanels({ clusterType: "kubernetes" }),
    );

    expect(result.current.selectedPanel).toBe("gpu");

    act(() => {
      result.current.setSelectedPanel("node");
    });
    expect(result.current.selectedPanel).toBe("node");

    act(() => {
      result.current.setSelectedPanel("gpu");
    });
    expect(result.current.selectedPanel).toBe("gpu");
  });

  it("should fallback to first panel when cluster type changes", () => {
    const { result, rerender } = renderHook(
      ({ clusterType }) => useClusterMonitorPanels({ clusterType }),
      { initialProps: { clusterType: "kubernetes" } },
    );

    act(() => {
      result.current.setSelectedPanel("gpu");
    });
    expect(result.current.selectedPanel).toBe("gpu");

    // Change to ssh cluster
    rerender({ clusterType: "ssh" });

    // Should fallback to ray (first available panel for ssh)
    expect(result.current.selectedPanel).toBe("ray");
  });

  it("should return empty panels for unknown cluster type", () => {
    const { result } = renderHook(() =>
      useClusterMonitorPanels({ clusterType: "unknown" }),
    );

    expect(result.current.panels).toEqual([]);
    expect(result.current.selectedPanel).toBeNull();
    expect(result.current.showMonitorTab).toBe(false);
  });
});
