import { describe, expect, it } from "vitest";
import {
  flopsTotals,
  formatFlops,
  parseTflops,
  peakTflops,
} from "./accelerator-tflops";

describe("FP16 estimates", () => {
  const device = {
    node: "n",
    uuid: "g",
    index: 0,
    product: "T4",
    healthy: true,
    totalMiB: null,
    allocatedMiB: null,
  };
  const sample = (uuid: string, value: number) => ({
    metric: "neutree_accelerator_utilization_ratio",
    labels: { node: "n", accelerator_uuid: uuid },
    value,
    observed_at: 1,
  });
  it("retains known capacity and measured usage when other cards are unknown or missing metrics", () => {
    const devices = [
      { ...device, uuid: "unknown", product: "unknown" },
      { ...device, uuid: "missing" },
      device,
      { ...device, uuid: "bad", healthy: false },
    ];
    expect(
      flopsTotals(devices, [sample("g", 0.5), sample("bad", 1)], {}),
    ).toEqual({ total: 130, used: 32.5 });
    expect(flopsTotals([...devices].reverse(), [sample("g", 0)], {})).toEqual({
      total: 130,
      used: 0,
    });
  });
  it("keeps entirely unknown values unknown and an empty cluster at zero", () => {
    expect(
      flopsTotals([{ ...device, product: "unknown" }], [sample("g", 0.5)], {}),
    ).toEqual({ total: null, used: null });
    expect(flopsTotals([], [], {})).toEqual({ total: 0, used: 0 });
    for (const value of [NaN, Infinity, -0.1, 1.1]) {
      expect(flopsTotals([device], [sample("g", value)], {})).toEqual({
        total: 65,
        used: null,
      });
    }
  });
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
