import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  useClusterMonitorPanels,
  useEndpointMonitorPanels,
} from "./use-monitor-panels";

describe("useEndpointMonitorPanels", () => {
  it("should return empty panels when no cluster type or engine type", () => {
    const { result } = renderHook(() => useEndpointMonitorPanels({}));

    expect(result.current.panels).toEqual([]);
    expect(result.current.selectedPanel).toBeNull();
    expect(result.current.showMonitorTab).toBe(false);
    expect(result.current.showSelector).toBe(false);
  });

  it("should return endpoint panel for ssh cluster", () => {
    const { result } = renderHook(() =>
      useEndpointMonitorPanels({ clusterType: "ssh" }),
    );

    expect(result.current.panels).toEqual(["endpoint"]);
    expect(result.current.selectedPanel).toBe("endpoint");
    expect(result.current.showMonitorTab).toBe(true);
    expect(result.current.showSelector).toBe(false);
  });

  it("should return vllm panel for vllm engine", () => {
    const { result } = renderHook(() =>
      useEndpointMonitorPanels({ engineType: "vllm" }),
    );

    expect(result.current.panels).toEqual(["vllm"]);
    expect(result.current.selectedPanel).toBe("vllm");
    expect(result.current.showMonitorTab).toBe(true);
    expect(result.current.showSelector).toBe(false);
  });

  it("should return both panels for ssh cluster with vllm engine", () => {
    const { result } = renderHook(() =>
      useEndpointMonitorPanels({ clusterType: "ssh", engineType: "vllm" }),
    );

    expect(result.current.panels).toEqual(["vllm", "endpoint"]);
    expect(result.current.selectedPanel).toBe("vllm");
    expect(result.current.showMonitorTab).toBe(true);
    expect(result.current.showSelector).toBe(true);
  });

  it("should allow user to select panel", () => {
    const { result } = renderHook(() =>
      useEndpointMonitorPanels({ clusterType: "ssh", engineType: "vllm" }),
    );

    expect(result.current.selectedPanel).toBe("vllm");

    act(() => {
      result.current.setSelectedPanel("endpoint");
    });

    expect(result.current.selectedPanel).toBe("endpoint");
  });

  it("should fallback to first panel if selected panel is invalid", () => {
    const { result, rerender } = renderHook(
      ({ clusterType, engineType }) =>
        useEndpointMonitorPanels({ clusterType, engineType }),
      { initialProps: { clusterType: "ssh", engineType: "vllm" } },
    );

    act(() => {
      result.current.setSelectedPanel("vllm");
    });
    expect(result.current.selectedPanel).toBe("vllm");

    // Remove vllm engine, vllm panel should no longer be available
    rerender({ clusterType: "ssh", engineType: undefined as any });

    // Should fallback to first available panel
    expect(result.current.selectedPanel).toBe("endpoint");
  });
});

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
