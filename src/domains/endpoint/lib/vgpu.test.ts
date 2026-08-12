import { describe, expect, it } from "vitest";
import type { ResourceSpec } from "@/foundation/types/serving-types";
import {
  formatVgpuMemoryGiBInputValue,
  getEffectiveVgpuMemoryMiB,
  getRoundedVgpuMemoryGiBValue,
  getVgpuMemoryDisplay,
  getVgpuVirtualization,
  hasVgpuResources,
  isVgpuVirtualizationResourceSupported,
  normalizeVgpuMemoryGiBInput,
  normalizeVgpuVirtualization,
  VGPU_VIRTUALIZATION_CORE_PERCENT_RESOURCE_KEY,
  VGPU_VIRTUALIZATION_MEMORY_MIB_RESOURCE_KEY,
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

  it("does not treat core-only virtualization as vGPU", () => {
    expect(
      hasVgpuResources({
        gpu: 1,
        accelerator: {
          type: "nvidia_gpu",
          product: "Tesla-T4",
          virtualization: {
            core_percent: 50,
          },
        },
      } as ResourceSpec),
    ).toBe(false);
  });

  it("does not treat non-positive memory virtualization as vGPU", () => {
    expect(
      hasVgpuResources({
        gpu: 1,
        accelerator: {
          type: "nvidia_gpu",
          product: "Tesla-T4",
          virtualization: {
            memory_mib: 0,
            core_percent: 50,
          },
        },
      } as ResourceSpec),
    ).toBe(false);

    expect(
      normalizeVgpuVirtualization({
        memory_mib: 0,
        memory_percent: 0,
        core_percent: 50,
      }),
    ).toEqual({ core_percent: 50 });
  });

  it("ignores memory_percent virtualization values", () => {
    expect(
      normalizeVgpuVirtualization({
        memory_percent: 50,
        core_percent: 50,
      }),
    ).toEqual({ core_percent: 50 });

    expect(getEffectiveVgpuMemoryMiB({ memory_percent: 50 }, 15360)).toBeNull();

    expect(
      hasVgpuResources({
        gpu: 1,
        accelerator: {
          type: "nvidia_gpu",
          product: "Tesla-T4",
          virtualization: {
            memory_percent: 50,
            core_percent: 50,
          },
        },
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

  it("prefers explicit memory_mib for effective memory", () => {
    expect(
      getEffectiveVgpuMemoryMiB(
        { memory_mib: 10240, memory_percent: undefined },
        15360,
      ),
    ).toBe(10240);
  });

  it("normalizes empty memory fields and ignores memory_percent", () => {
    expect(
      normalizeVgpuVirtualization({
        memory_mib: "" as unknown as number,
        memory_percent: 50,
        core_percent: "30" as unknown as number,
      }),
    ).toEqual({
      core_percent: 30,
    });
  });

  it("formats memory display in GiB and ignores percentage mode", () => {
    expect(getVgpuMemoryDisplay({ memory_mib: 10240 }, 15360)).toBe("10.0 GiB");
    expect(getVgpuMemoryDisplay({ memory_percent: 50 }, 15360)).toBeNull();
  });

  it("rounds the raw vGPU memory max for display", () => {
    expect(getRoundedVgpuMemoryGiBValue(46068)).toBe(45);
    expect(formatVgpuMemoryGiBInputValue(46068, 46068)).toBe("45");
  });

  it("formats aligned vGPU memory values by the displayed GiB bucket", () => {
    expect(formatVgpuMemoryGiBInputValue(1012, 46068)).toBe("1");
  });

  it("clamps vGPU memory inputs within the displayed boundary to raw MiB", () => {
    expect(normalizeVgpuMemoryGiBInput(45, 46068)).toBe(46068);
    expect(normalizeVgpuMemoryGiBInput(44.99, 46068)).toBe(46068);
    expect(normalizeVgpuMemoryGiBInput(46, 46068)).toBe(47104);
  });

  it("clamps vGPU memory inputs within the remaining display boundary", () => {
    expect(formatVgpuMemoryGiBInputValue(500, 46068, 500)).toBe("0.5");
    expect(normalizeVgpuMemoryGiBInput(0.5, 46068, 500)).toBe(500);
    expect(normalizeVgpuMemoryGiBInput(0.51, 46068, 500)).toBe(523);
  });

  it("rejects non-finite vGPU memory inputs", () => {
    expect(normalizeVgpuMemoryGiBInput(Number.POSITIVE_INFINITY, 46068)).toBe(
      undefined,
    );
  });

  it("treats a missing supported-resources list as supporting every resource", () => {
    expect(
      isVgpuVirtualizationResourceSupported(
        undefined,
        VGPU_VIRTUALIZATION_CORE_PERCENT_RESOURCE_KEY,
      ),
    ).toBe(true);
    expect(
      isVgpuVirtualizationResourceSupported(
        null,
        VGPU_VIRTUALIZATION_MEMORY_MIB_RESOURCE_KEY,
      ),
    ).toBe(true);
    expect(
      isVgpuVirtualizationResourceSupported(
        [],
        VGPU_VIRTUALIZATION_CORE_PERCENT_RESOURCE_KEY,
      ),
    ).toBe(true);
  });

  it("reports a resource as supported when it appears in the list", () => {
    expect(
      isVgpuVirtualizationResourceSupported(
        [
          VGPU_VIRTUALIZATION_MEMORY_MIB_RESOURCE_KEY,
          VGPU_VIRTUALIZATION_CORE_PERCENT_RESOURCE_KEY,
        ],
        VGPU_VIRTUALIZATION_CORE_PERCENT_RESOURCE_KEY,
      ),
    ).toBe(true);
    expect(
      isVgpuVirtualizationResourceSupported(
        [VGPU_VIRTUALIZATION_MEMORY_MIB_RESOURCE_KEY],
        VGPU_VIRTUALIZATION_MEMORY_MIB_RESOURCE_KEY,
      ),
    ).toBe(true);
  });

  it("reports a resource as unsupported when it is missing from the list", () => {
    expect(
      isVgpuVirtualizationResourceSupported(
        [VGPU_VIRTUALIZATION_MEMORY_MIB_RESOURCE_KEY],
        VGPU_VIRTUALIZATION_CORE_PERCENT_RESOURCE_KEY,
      ),
    ).toBe(false);
  });
});
