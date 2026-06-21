import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEndpointMonitorPanels } from "./use-endpoint-monitor-panels";

type UseHookArgs = {
  clusterType?: string;
  engineType?: string;
};

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

  it("should return sglang panel for sglang engine", () => {
    const { result } = renderHook(() =>
      useEndpointMonitorPanels({ engineType: "sglang" }),
    );

    expect(result.current.panels).toEqual(["sglang"]);
    expect(result.current.selectedPanel).toBe("sglang");
    expect(result.current.showMonitorTab).toBe(true);
    expect(result.current.showSelector).toBe(false);
  });

  it("should return vGPU panel for kubernetes endpoint with vGPU resources", () => {
    const { result } = renderHook(() =>
      useEndpointMonitorPanels({
        clusterType: "kubernetes",
        hasVgpuResources: true,
      }),
    );

    expect(result.current.panels).toEqual(["vgpu"]);
    expect(result.current.selectedPanel).toBe("vgpu");
    expect(result.current.showMonitorTab).toBe(true);
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

  it("should return both panels for ssh cluster with sglang engine", () => {
    const { result } = renderHook(() =>
      useEndpointMonitorPanels({ clusterType: "ssh", engineType: "sglang" }),
    );

    expect(result.current.panels).toEqual(["sglang", "endpoint"]);
    expect(result.current.selectedPanel).toBe("sglang");
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
      ({ clusterType, engineType }: UseHookArgs) =>
        useEndpointMonitorPanels({ clusterType, engineType }),
      {
        initialProps: { clusterType: "ssh", engineType: "vllm" } as UseHookArgs,
      },
    );

    act(() => {
      result.current.setSelectedPanel("vllm");
    });
    expect(result.current.selectedPanel).toBe("vllm");

    // Remove vllm engine, vllm panel should no longer be available
    rerender({ clusterType: "ssh", engineType: undefined });

    // Should fallback to first available panel
    expect(result.current.selectedPanel).toBe("endpoint");
  });

  it("should fallback to first panel when sglang panel is no longer available", () => {
    const { result, rerender } = renderHook(
      ({ clusterType, engineType }: UseHookArgs) =>
        useEndpointMonitorPanels({ clusterType, engineType }),
      {
        initialProps: {
          clusterType: "ssh",
          engineType: "sglang",
        } as UseHookArgs,
      },
    );

    act(() => {
      result.current.setSelectedPanel("sglang");
    });
    expect(result.current.selectedPanel).toBe("sglang");

    // Remove sglang engine, sglang panel should no longer be available
    rerender({ clusterType: "ssh", engineType: undefined });

    // Should fallback to first available panel
    expect(result.current.selectedPanel).toBe("endpoint");
  });
});
