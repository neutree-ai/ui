import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMonitorPanels } from "./use-monitor-panels";

describe("useMonitorPanels", () => {
  it("should return empty panels when no conditions are met", () => {
    const { result } = renderHook(() =>
      useMonitorPanels({ clusterType: "k8s", engineType: "other" }),
    );

    expect(result.current.panels).toEqual([]);
    expect(result.current.selectedPanel).toBeNull();
    expect(result.current.showMonitorTab).toBe(false);
    expect(result.current.showSelector).toBe(false);
  });

  it("should return endpoint panel when cluster is ssh", () => {
    const { result } = renderHook(() =>
      useMonitorPanels({ clusterType: "ssh", engineType: "other" }),
    );

    expect(result.current.panels).toEqual(["endpoint"]);
    expect(result.current.selectedPanel).toBe("endpoint");
    expect(result.current.showMonitorTab).toBe(true);
    expect(result.current.showSelector).toBe(false);
  });

  it("should return vllm panel when engine is vllm", () => {
    const { result } = renderHook(() =>
      useMonitorPanels({ clusterType: "k8s", engineType: "vllm" }),
    );

    expect(result.current.panels).toEqual(["vllm"]);
    expect(result.current.selectedPanel).toBe("vllm");
    expect(result.current.showMonitorTab).toBe(true);
    expect(result.current.showSelector).toBe(false);
  });

  it("should return both panels when cluster is ssh and engine is vllm", () => {
    const { result } = renderHook(() =>
      useMonitorPanels({ clusterType: "ssh", engineType: "vllm" }),
    );

    expect(result.current.panels).toEqual(["endpoint", "vllm"]);
    expect(result.current.selectedPanel).toBe("endpoint"); // Defaults to first
    expect(result.current.showMonitorTab).toBe(true);
    expect(result.current.showSelector).toBe(true);
  });

  it("should allow switching panels", () => {
    const { result } = renderHook(() =>
      useMonitorPanels({ clusterType: "ssh", engineType: "vllm" }),
    );

    expect(result.current.selectedPanel).toBe("endpoint");

    act(() => {
      result.current.setSelectedPanel("vllm");
    });

    expect(result.current.selectedPanel).toBe("vllm");
  });

  it("should reset selected panel if it becomes invalid", () => {
    const { result, rerender } = renderHook(
      ({ clusterType, engineType }) =>
        useMonitorPanels({ clusterType, engineType }),
      {
        initialProps: { clusterType: "ssh", engineType: "vllm" },
      },
    );

    // Select vllm
    act(() => {
      result.current.setSelectedPanel("vllm");
    });
    expect(result.current.selectedPanel).toBe("vllm");

    // Change props so vllm is no longer available (e.g. engine changes)
    rerender({ clusterType: "ssh", engineType: "other" });

    expect(result.current.panels).toEqual(["endpoint"]);
    expect(result.current.selectedPanel).toBe("endpoint");
  });
});
