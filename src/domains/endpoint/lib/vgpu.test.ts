import { describe, expect, it } from "vitest";
import type { ResourceSpec } from "@/foundation/types/serving-types";
import {
  getEffectiveVgpuMemoryMiB,
  getVgpuMemoryDisplay,
  getVgpuVirtualization,
  hasVgpuResources,
  normalizeVgpuVirtualization,
} from "./vgpu";

describe("endpoint vgpu helpers", () => {
  it("detects resources with accelerator virtualization", () => {
    const resources = {
      gpu: 1,
      accelerator: {
        type: "nvidia_gpu",
        product: "Tesla-T4",
        virtualization: {
          memory_mib: 10240,
          core_percent: 30,
        },
      },
    } as ResourceSpec;

    expect(hasVgpuResources(resources)).toBe(true);
  });

  it("does not treat plain accelerator resources as vGPU", () => {
    expect(
      hasVgpuResources({
        gpu: 1,
        accelerator: { type: "nvidia_gpu", product: "Tesla-T4" },
      } as ResourceSpec),
    ).toBe(false);
  });

  it("detects backend flat vGPU keys", () => {
    const resources = {
      gpu: 1,
      accelerator: {
        type: "nvidia_gpu",
        product: "Tesla-T4",
        "virtualization.memory_mib": "8192",
        "virtualization.core_percent": "50",
      },
    } as unknown as ResourceSpec;

    expect(hasVgpuResources(resources)).toBe(true);
    expect(getVgpuVirtualization(resources.accelerator)).toEqual({
      memory_mib: 8192,
      core_percent: 50,
    });
  });

  it("computes effective memory from percentage using ceiling", () => {
    expect(getEffectiveVgpuMemoryMiB({ memory_percent: 33 }, 15360)).toBe(5069);
  });

  it("prefers explicit memory_mib for effective memory", () => {
    expect(
      getEffectiveVgpuMemoryMiB(
        { memory_mib: 10240, memory_percent: undefined },
        15360,
      ),
    ).toBe(10240);
  });

  it("normalizes empty and mutually exclusive memory fields", () => {
    expect(
      normalizeVgpuVirtualization({
        memory_mib: "" as unknown as number,
        memory_percent: 50,
        core_percent: "30" as unknown as number,
      }),
    ).toEqual({
      memory_percent: 50,
      core_percent: 30,
    });
  });

  it("formats memory display in MiB and percentage modes", () => {
    expect(getVgpuMemoryDisplay({ memory_mib: 10240 }, 15360)).toBe(
      "10240 MiB",
    );
    expect(getVgpuMemoryDisplay({ memory_percent: 50 }, 15360)).toBe(
      "50% (7680 MiB)",
    );
  });
});
