import { describe, expect, it } from "vitest";
import {
  flopsTotals,
  formatFlops,
  parseTflops,
  peakTflops,
  productPeakTflops,
  observedDevices,
} from "./accelerator-tflops";

describe("FP16 estimates", () => {
  const device = {
    node: "n",
    uuid: "g",
    index: 0,
    product: "T4",
    peakFP16TFLOPS: 65,
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
      { ...device, uuid: "unknown", product: "unknown", peakFP16TFLOPS: null },
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
      flopsTotals(
        [{ ...device, product: "unknown", peakFP16TFLOPS: null }],
        [sample("g", 0.5)],
        {},
      ),
    ).toEqual({ total: null, used: null });
    expect(flopsTotals([], [], {})).toEqual({ total: 0, used: 0 });
    for (const value of [NaN, Infinity, -0.1, 1.1]) {
      expect(flopsTotals([device], [sample("g", value)], {})).toEqual({
        total: 65,
        used: null,
      });
    }
  });
  it("uses backend specifications and exact calibration without model defaults", () => {
    expect(peakTflops("NVIDIA A100")).toBeNull();
    expect(peakTflops("NVIDIA A100", {}, 312)).toBe(312);
    expect(peakTflops("Tesla-T4", { "Tesla-T4": 70 }, 65)).toBe(70);
    expect(peakTflops("unknown")).toBeNull();
    for (const value of [NaN, Infinity, 0, -1])
      expect(peakTflops("T4", {}, value)).toBeNull();
  });
  it("gets exact product metadata for cards and treats conflicting types as unknown", () => {
    const info = {
      accelerator_metadata: {
        nvidia_gpu: { products: { T4: { peak_fp16_tflops: 65 } } },
      },
      node_resources: {
        n: { devices: [{ uuid: "g", product: "T4", health: true }] },
      },
    } as unknown as Parameters<typeof observedDevices>[0];
    expect(productPeakTflops(info, "T4")).toBe(65);
    expect(productPeakTflops(info, "Tesla-T4")).toBeNull();
    expect(observedDevices(info)[0].peakFP16TFLOPS).toBe(65);
    expect(
      productPeakTflops(
        {
          ...info,
          accelerator_metadata: {
            ...info?.accelerator_metadata,
            example: { products: { T4: { peak_fp16_tflops: 70 } } },
          },
        } as typeof info,
        "T4",
      ),
    ).toBeNull();
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
      peakFP16TFLOPS: 65,
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
