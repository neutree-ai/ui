import { describe, expect, it } from "vitest";
import { makeGpuDevice } from "@/foundation/testing/resource-builders";
import { observedGpuFromDevice } from "./observed-gpu";

describe("observedGpuFromDevice", () => {
  it("maps the device pools onto the observed card", () => {
    expect(
      observedGpuFromDevice(
        "node-a",
        makeGpuDevice("GPU-1", { memory_mib: 7680, core_units: 50 }),
        0,
      ),
    ).toEqual({
      node: "node-a",
      uuid: "GPU-1",
      index: 1,
      product: "Tesla-T4",
      totalMiB: 15360,
      allocatedMiB: 7680,
      coreUnits: 100,
      healthy: true,
    });
  });

  it.each([
    { name: "uses the reported order", order: 4, index: 0, expected: 4 },
    { name: "falls back to the position", order: null, index: 2, expected: 3 },
  ])("$name", ({ order, index, expected }) => {
    expect(
      observedGpuFromDevice(
        "n",
        makeGpuDevice("G", undefined, { order }),
        index,
      ).index,
    ).toBe(expected);
  });

  it.each([
    {
      name: "floors over-reported availability at zero",
      available: 20000,
      total: 15360,
      expected: 0,
    },
    {
      name: "is unknown without availability",
      available: null,
      total: 15360,
      expected: null,
    },
    {
      name: "is unknown without a pool size",
      available: 0,
      total: null,
      expected: null,
    },
  ])("allocated memory $name", ({ available, total, expected }) => {
    const device = makeGpuDevice(
      "G",
      available == null ? null : { memory_mib: available, core_units: 0 },
      {
        allocatable:
          total == null ? null : { memory_mib: total, core_units: 100 },
      },
    );
    expect(observedGpuFromDevice("n", device, 0).allocatedMiB).toBe(expected);
  });
});
