import { describe, expect, it } from "vitest";
import {
  parseTflops,
  peakTflops,
  productPeakTflops,
} from "./accelerator-tflops";

describe("accelerator FP16 specifications", () => {
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
    } as unknown as Parameters<typeof productPeakTflops>[0];
    expect(productPeakTflops(info, "T4")).toBe(65);
    expect(productPeakTflops(info, "Tesla-T4")).toBeNull();
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
  it("rejects invalid calibration values", () => {
    expect(parseTflops('{"T4":0,"H100":-2,"A10":"125","L4":121}')).toEqual({
      L4: 121,
    });
    expect(parseTflops("broken")).toEqual({});
  });
});
