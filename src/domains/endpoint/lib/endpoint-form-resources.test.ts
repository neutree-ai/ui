// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { type FieldValues, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import {
  alignedVgpuMemory,
  catalogAcceleratorMismatch,
  reconcileAccelerator,
  supportedVirtualization,
  virtualizationForCoreInput,
  virtualizationForMemoryInput,
} from "./endpoint-form-resources";

const T4 = { type: "nvidia_gpu", product: "Tesla-T4" };
const L4 = { type: "nvidia_gpu", product: "L4" };

const resourcesForm = (accelerator: unknown) =>
  renderHook(() =>
    useForm<FieldValues>({
      defaultValues: { spec: { resources: { accelerator } } },
    }),
  ).result.current;

describe("supportedVirtualization", () => {
  const both = { memory_mib: 4096, core_percent: 25 };

  it.each([
    [{ core: true, memory: true }, both],
    [{ core: false, memory: true }, { memory_mib: 4096 }],
    [{ core: false, memory: false }, undefined],
  ])("supported %o -> %o", (supported, expected) => {
    expect(supportedVirtualization(both, supported)).toEqual(expected);
  });

  it("returns the same object when nothing is dropped", () => {
    expect(supportedVirtualization(both, { core: true, memory: true })).toBe(
      both,
    );
  });
});

describe("alignedVgpuMemory", () => {
  it("snaps the memory to a boundary the shown GiB rounds to", () => {
    expect(alignedVgpuMemory({ memory_mib: 1024 }, 15360, 1012)).toEqual({
      memory_mib: 1012,
    });
  });

  it("returns the same object when already aligned or unbounded", () => {
    const virtualization = { memory_mib: 4096 };
    expect(alignedVgpuMemory(virtualization, 15360, 8192)).toBe(virtualization);
    expect(alignedVgpuMemory(virtualization, 15360, null)).toBe(virtualization);
  });
});

describe("virtualizationForMemoryInput", () => {
  const current = { memory_mib: 2048, core_percent: 25 };

  it.each([
    ["4", { value: { core_percent: 25, memory_mib: 4096 } }],
    ["", { value: { core_percent: 25 } }],
    ["0", { value: { core_percent: 25 } }],
    ["abc", null],
  ])("%j -> %o", (raw, expected) => {
    expect(virtualizationForMemoryInput(raw, current, 15360, 15360)).toEqual(
      expected,
    );
  });
});

describe("virtualizationForCoreInput", () => {
  it.each([
    [
      "30",
      { memory_mib: 2048 },
      { value: { memory_mib: 2048, core_percent: 30 } },
    ],
    [
      "",
      { memory_mib: 2048, core_percent: 30 },
      { value: { memory_mib: 2048 } },
    ],
    ["0", { core_percent: 30 }, { value: undefined }],
    ["abc", { core_percent: 30 }, null],
  ])("%j on %o -> %o", (raw, current, expected) => {
    expect(virtualizationForCoreInput(raw, current)).toEqual(expected);
  });
});

describe("reconcileAccelerator", () => {
  const reconciled = (
    accelerator: unknown,
    options: (typeof T4)[],
    engineTypes: string[] = [],
  ) => {
    const form = resourcesForm(accelerator);
    act(() => reconcileAccelerator(form, options, engineTypes));
    return form.getValues("spec.resources.accelerator");
  };

  it("keeps an offered accelerator", () => {
    expect(reconciled(T4, [T4, L4])).toEqual(T4);
  });

  it("clears an unavailable selection instead of mapping to the only option", () => {
    expect(
      reconciled({ ...L4, virtualization: { memory_mib: 1024 } }, [T4]),
    ).toBe(null);
  });

  it("clears an accelerator the cluster does not offer when several remain", () => {
    expect(reconciled({ type: "amd_gpu", product: "MI300" }, [T4, L4])).toBe(
      null,
    );
  });

  it.each([{ options: [T4] }, { options: [T4, L4] }])(
    "leaves an unset accelerator for the user among %o",
    ({ options }) => {
      expect(reconciled(null, options)).toBe(null);
    },
  );

  it("drops an accelerator the engine ships no image for", () => {
    expect(reconciled(T4, [T4], ["amd_gpu"])).toBe(null);
  });
});

describe("catalogAcceleratorMismatch", () => {
  it.each([
    [null, { type: "nvidia_gpu", product: "H100" }, false],
    [T4, null, false],
    [T4, { type: "nvidia_gpu", product: "T4" }, false],
    [T4, { type: "nvidia_gpu", product: "H100" }, true],
    [T4, { type: "amd_gpu", product: "Tesla-T4" }, true],
  ])(
    "selected %o against catalog %o -> %s",
    (selected, reference, expected) => {
      expect(
        catalogAcceleratorMismatch(
          selected as Parameters<typeof catalogAcceleratorMismatch>[0],
          reference as Parameters<typeof catalogAcceleratorMismatch>[1],
        ),
      ).toBe(expected);
    },
  );
});
