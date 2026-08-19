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

  it("judges on the rounded total the badge displays", () => {
    // The badge renders formatGb(totalGb), rounded to one decimal — the UI's
    // rule for available resources (cluster panels use toFixed(1)). The check
    // compares that rounded total against the requirement, so a verdict can
    // never contradict what the user sees. Notably 2 × 23.98828125 GiB =
    // 47.9765625 GiB rounds to 48: a pair of 24 GB cards meets a 48 GB
    // requirement, fixing the false "insufficient" verdict.
    const cases: Array<[number, number, "sufficient" | "insufficient"]> = [
      [47.9, 48, "insufficient"], // rounds to 47.9 < 48
      [47.95, 48, "sufficient"], // rounds to 48 (half-up) == 48
      [47.9765625, 48, "sufficient"], // 2×23.98828125 GiB RTX-4090 case
      [47.5, 48, "insufficient"], // rounds to 47.5 < 48
      [48.0001, 48, "sufficient"], // rounds to 48 == 48
    ];
    for (const [available, required, expected] of cases) {
      const r = checkVRAM({
        acceleratorProduct: "NVIDIA-GeForce-RTX-4090",
        perGpuGb: available,
        gpuCount: 1,
        requiredGb: required,
      });
      expect(r.kind, `avail=${available} req=${required}`).toBe(expected);
    }
  });

  it("compares the requirement as declared, not rounded", () => {
    // Only the available total is rounded to display precision; the
    // requirement is used verbatim. 48.04 GiB required stays 48.04 (not 48.0),
    // so 48.03 GiB available (rounds to 48.0) is insufficient even though
    // formatGb would show both as "48".
    expect(
      checkVRAM({
        acceleratorProduct: "X",
        perGpuGb: 48.03,
        gpuCount: 1,
        requiredGb: 48.04,
      }).kind,
    ).toBe("insufficient");
    // A fractional requirement near a .1 boundary: 48.06 rounds to 48.1 which
    // meets 48.09 as declared; 48.04 rounds to 48.0 which does not.
    expect(
      checkVRAM({
        acceleratorProduct: "X",
        perGpuGb: 48.06,
        gpuCount: 1,
        requiredGb: 48.09,
      }).kind,
    ).toBe("sufficient");
    expect(
      checkVRAM({
        acceleratorProduct: "X",
        perGpuGb: 48.04,
        gpuCount: 1,
        requiredGb: 48.09,
      }).kind,
    ).toBe("insufficient");
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
    expect(formatGb(48)).toBe("48");
  });

  it("rounds a just-sufficient value up to show equal numbers (48.0001 -> 48)", () => {
    // 48.0001 GiB is sufficient for a 48 GB floor; rounding shows "48 GB
    // available, 48 GB required" beside a green check, which reads as "just
    // enough" — consistent with the check judging on the same rounded value.
    expect(formatGb(48.0001)).toBe("48");
  });

  it("preserves a meaningful single decimal", () => {
    expect(formatGb(47.5)).toBe("47.5");
  });
});
