import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEndpointMonitorPanels } from "./use-endpoint-monitor-panels";

type UseHookArgs = {
  engineType?: string;
};

describe("useEndpointMonitorPanels", () => {
  const SPLIT_PANELS = ["overview", "latency", "throughput", "queue", "cache"];

  it.each([
    { engineType: undefined, panels: [], selected: null, tab: false },
    {
      engineType: "llama-cpp",
      panels: ["overview"],
      selected: "overview",
      tab: true,
    },
    {
      engineType: "vllm",
      panels: SPLIT_PANELS,
      selected: "overview",
      tab: true,
    },
    {
      engineType: "sglang",
      panels: SPLIT_PANELS,
      selected: "overview",
      tab: true,
    },
  ])(
    "offers $panels for engine $engineType",
    ({ engineType, panels, selected, tab }) => {
      const { result } = renderHook(() =>
        useEndpointMonitorPanels({ engineType }),
      );

      expect(result.current.panels).toEqual(panels);
      expect(result.current.selectedPanel).toBe(selected);
      expect(result.current.showMonitorTab).toBe(tab);
      expect(result.current.showSelector).toBe(panels.length > 1);
    },
  );

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
