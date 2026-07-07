import { describe, expect, it } from "vitest";
import type { ResourceSpec } from "@/foundation/types/serving-types";
import {
  formatVgpuMemoryGiBInputValue,
  getEffectiveVgpuMemoryMiB,
  getRoundedVgpuMemoryGiBValue,
  getVgpuMemoryDisplay,
  getVgpuVirtualization,
  hasVgpuResources,
  normalizeVgpuMemoryGiBInput,
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

  it("formats memory display in GiB and percentage modes", () => {
    expect(getVgpuMemoryDisplay({ memory_mib: 10240 }, 15360)).toBe("10.0 GiB");
    expect(getVgpuMemoryDisplay({ memory_percent: 50 }, 15360)).toBe(
      "50% (7.5 GiB)",
    );
  });

  it("rounds the raw vGPU memory max for display", () => {
    expect(getRoundedVgpuMemoryGiBValue(46068)).toBe(45);
    expect(formatVgpuMemoryGiBInputValue(46068, 46068)).toBe("45");
  });

  it("clamps vGPU memory inputs within the displayed boundary to raw MiB", () => {
    expect(normalizeVgpuMemoryGiBInput(45, 46068)).toBe(46068);
    expect(normalizeVgpuMemoryGiBInput(44.99, 46068)).toBe(46068);
    expect(normalizeVgpuMemoryGiBInput(46, 46068)).toBe(47104);
  });

  it("rejects non-finite vGPU memory inputs", () => {
    expect(normalizeVgpuMemoryGiBInput(Number.POSITIVE_INFINITY, 46068)).toBe(
      undefined,
    );
  });
});
