import { describe, it, expect } from "vitest";
import {
  peakTflops,
  parseTflops,
  formatFlops,
  flopsTotals,
} from "./accelerator-tflops";
describe("FP16 estimates", () => {
  it("matches longest model first and honors exact calibration", () => {
    expect(peakTflops("NVIDIA A100")).toBe(312);
    expect(peakTflops("NVIDIA L40S")).toBe(362);
    expect(peakTflops("Tesla-T4", { "Tesla-T4": 70 })).toBe(70);
    expect(peakTflops("unknown")).toBeNull();
  });
  it("rejects invalid calibration and formats PFLOPS", () => {
    expect(parseTflops('{"T4":0,"H100":-2,"A10":"125","L4":121}')).toEqual({
      L4: 121,
    });
    expect(parseTflops("broken")).toEqual({});
    expect(formatFlops(1500)).toBe("1.50 PFLOPS");
  });
  it("excludes unhealthy devices and keeps missing usage unknown", () => {
    const device = {
      node: "n",
      uuid: "g",
      index: 0,
      product: "T4",
      healthy: true,
      totalMiB: null,
      allocatedMiB: null,
    };
    expect(
      flopsTotals([device, { ...device, uuid: "bad", healthy: false }], [], {}),
    ).toEqual({ total: 65, used: null });
    expect(
      flopsTotals(
        [device],
        [
          {
            metric: "neutree_accelerator_utilization_ratio",
            labels: { node: "n", accelerator_uuid: "g" },
            value: 0,
            observed_at: 1,
          },
        ],
        {},
      ),
    ).toEqual({ total: 65, used: 0 });
  });
});
