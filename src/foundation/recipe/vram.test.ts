import { describe, expect, it } from "vitest";
import { checkVRAM, formatGb, matchesAcceleratorName } from "./vram";

describe("matchesAcceleratorName", () => {
  it("matches a bare name against a vendor-prefixed product string", () => {
    expect(matchesAcceleratorName("NVIDIA-H100-80GB-HBM3", ["H100"])).toBe(
      true,
    );
    expect(matchesAcceleratorName("Tesla-V100-SXM2-16GB", ["V100"])).toBe(true);
    expect(
      matchesAcceleratorName("NVIDIA-L40S", ["H200", "H100", "L40S"]),
    ).toBe(true);
  });

  it("is case-insensitive and trims names", () => {
    expect(matchesAcceleratorName("nvidia-h100-80gb", [" H100 "])).toBe(true);
  });

  it("matches a complete multi-token product name", () => {
    expect(
      matchesAcceleratorName("NVIDIA-GeForce-RTX-4090", [
        "NVIDIA-GeForce-RTX-4090",
      ]),
    ).toBe(true);
  });

  it("does not match complete product names with different SKUs", () => {
    expect(
      matchesAcceleratorName("NVIDIA-GeForce-RTX-4090-Ti", [
        "NVIDIA-GeForce-RTX-4090",
      ]),
    ).toBe(false);
    expect(
      matchesAcceleratorName("NVIDIA-GeForce-RTX-4090-Laptop-GPU", [
        "NVIDIA-GeForce-RTX-4090",
      ]),
    ).toBe(false);
  });

  it("does not match on partial tokens", () => {
    // "H100" must not match a product whose only similar token is "H1000".
    expect(matchesAcceleratorName("NVIDIA-H1000", ["H100"])).toBe(false);
    expect(matchesAcceleratorName("NVIDIA-A100-40GB", ["H100"])).toBe(false);
  });
});

describe("checkVRAM", () => {
  it("prefers live per-GPU memory over the static table", () => {
    // Product unknown to the table, but live memory is supplied.
    const r = checkVRAM({
      acceleratorProduct: "Brand-New-GPU-Z1",
      perGpuGb: 96,
      gpuCount: 2,
      requiredGb: 150,
    });
    expect(r).toMatchObject({ kind: "sufficient", perGpuGb: 96, totalGb: 192 });
  });

  it("resolves a vendor-prefixed product via the table when no live memory", () => {
    // "NVIDIA-H100-80GB" is not an exact table key but H100 is -> 80 GB/card.
    const r = checkVRAM({
      acceleratorProduct: "NVIDIA-H100-80GB",
      gpuCount: 1,
      requiredGb: 120,
    });
    expect(r).toMatchObject({
      kind: "insufficient",
      perGpuGb: 80,
      totalGb: 80,
    });
  });

  it("returns unknown when neither live memory nor a table match exists", () => {
    const r = checkVRAM({
      acceleratorProduct: "Totally-Unknown-Card",
      gpuCount: 1,
      requiredGb: 80,
    });
    expect(r.kind).toBe("unknown");
  });

  it("returns unknown without a required VRAM", () => {
    const r = checkVRAM({ acceleratorProduct: "H100", gpuCount: 1 });
    expect(r.kind).toBe("unknown");
  });
});

describe("formatGb", () => {
  it("rounds noisy fractional VRAM to one decimal", () => {
    expect(formatGb(89.9765625)).toBe("90");
    expect(formatGb(44.988)).toBe("45");
    expect(formatGb(23.45)).toBe("23.5");
  });

  it("keeps whole numbers clean (no trailing .0)", () => {
    expect(formatGb(140)).toBe("140");
    expect(formatGb(16)).toBe("16");
  });

  it("preserves a meaningful single decimal", () => {
    expect(formatGb(47.5)).toBe("47.5");
  });
});
