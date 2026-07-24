import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEndpointMonitorPanels } from "./use-endpoint-monitor-panels";

type UseHookArgs = {
  engineType?: string;
};

describe("useEndpointMonitorPanels", () => {
  it("should return empty panels when no engine type is available", () => {
    const { result } = renderHook(() => useEndpointMonitorPanels({}));

    expect(result.current.panels).toEqual([]);
    expect(result.current.selectedPanel).toBeNull();
    expect(result.current.showMonitorTab).toBe(false);
    expect(result.current.showSelector).toBe(false);
  });

  it("should return an overview panel for a non-LLM engine", () => {
    const { result } = renderHook(() =>
      useEndpointMonitorPanels({ engineType: "llama-cpp" }),
    );

    expect(result.current.panels).toEqual(["overview"]);
    expect(result.current.selectedPanel).toBe("overview");
    expect(result.current.showMonitorTab).toBe(true);
    expect(result.current.showSelector).toBe(false);
  });

  it("should return split endpoint panels for vllm engine", () => {
    const { result } = renderHook(() =>
      useEndpointMonitorPanels({ engineType: "vllm" }),
    );

    expect(result.current.panels).toEqual([
      "overview",
      "latency",
      "throughput",
      "queue",
      "cache",
    ]);
    expect(result.current.selectedPanel).toBe("overview");
    expect(result.current.showMonitorTab).toBe(true);
    expect(result.current.showSelector).toBe(true);
  });

  it("should return split endpoint panels for sglang engine", () => {
    const { result } = renderHook(() =>
      useEndpointMonitorPanels({ engineType: "sglang" }),
    );

    expect(result.current.panels).toEqual([
      "overview",
      "latency",
      "throughput",
      "queue",
      "cache",
    ]);
    expect(result.current.selectedPanel).toBe("overview");
    expect(result.current.showMonitorTab).toBe(true);
    expect(result.current.showSelector).toBe(true);
  });

  it("should not add separate GPU or vGPU panels", () => {
    const { result } = renderHook(() =>
      useEndpointMonitorPanels({
        engineType: "vllm",
      }),
    );

    expect(result.current.panels).toEqual([
      "overview",
      "latency",
      "throughput",
      "queue",
      "cache",
    ]);
    expect(result.current.selectedPanel).toBe("overview");
    expect(result.current.showMonitorTab).toBe(true);
  });

  it("should allow user to select panel", () => {
    const { result } = renderHook(() =>
      useEndpointMonitorPanels({ engineType: "vllm" }),
    );

    expect(result.current.selectedPanel).toBe("overview");

    act(() => {
      result.current.setSelectedPanel("throughput");
    });

    expect(result.current.selectedPanel).toBe("throughput");
  });

  it("should fallback to first panel if selected panel is invalid", () => {
    const { result, rerender } = renderHook(
      ({ engineType }: UseHookArgs) => useEndpointMonitorPanels({ engineType }),
      {
        initialProps: { engineType: "vllm" } as UseHookArgs,
      },
    );

    act(() => {
      result.current.setSelectedPanel("queue");
    });
    expect(result.current.selectedPanel).toBe("queue");

    rerender({ engineType: undefined });

    expect(result.current.selectedPanel).toBeNull();
  });

  it("should preserve selected split panel when switching between supported engines", () => {
    const { result, rerender } = renderHook(
      ({ engineType }: UseHookArgs) => useEndpointMonitorPanels({ engineType }),
      {
        initialProps: { engineType: "sglang" } as UseHookArgs,
      },
    );

    act(() => {
      result.current.setSelectedPanel("cache");
    });
    expect(result.current.selectedPanel).toBe("cache");

    rerender({ engineType: "vllm" });

    expect(result.current.selectedPanel).toBe("cache");
  });

  it("should fall back to overview when switching to a non-LLM engine", () => {
    const { result, rerender } = renderHook(
      ({ engineType }: UseHookArgs) => useEndpointMonitorPanels({ engineType }),
      {
        initialProps: { engineType: "vllm" } as UseHookArgs,
      },
    );

    act(() => {
      result.current.setSelectedPanel("queue");
    });

    rerender({ engineType: "llama-cpp" });

    expect(result.current.panels).toEqual(["overview"]);
    expect(result.current.selectedPanel).toBe("overview");
    expect(result.current.showMonitorTab).toBe(true);
    expect(result.current.showSelector).toBe(false);
  });
});
