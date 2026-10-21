import { renderHook, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useAcceleratorObservations } from "./use-accelerator-observations";
const state = vi.hoisted(() => ({ result: {} as any }));
vi.mock("@refinedev/core", () => ({ useCustom: () => state.result }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it.each([-600000, 600000])(
  "does not filter server samples with clock offset %s",
  (offset) => {
    const sample = {
      metric: "test",
      value: 0,
      labels: {},
      observed_at: 1000000,
    };
    vi.spyOn(Date, "now").mockReturnValue(sample.observed_at * 1000 + offset);
    state.result = { data: { data: { status: "ok", samples: [sample] } } };
    const { result, rerender } = renderHook(() =>
      useAcceleratorObservations("endpoints", "workspace", "endpoint"),
    );
    expect(result.current.samples).toEqual([sample]);
    state.result = { ...state.result, error: new Error("unavailable") };
    rerender();
    expect(result.current.samples).toEqual([]);
    expect(result.current.status).toBe("unavailable");
  },
);
