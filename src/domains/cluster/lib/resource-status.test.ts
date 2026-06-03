import { describe, expect, it } from "vitest";
import type { NodeResourceStatus } from "@/foundation/types/resource-types";
import {
  getAcceleratorProductQuantities,
  getNodeDeviceResourceRows,
} from "./resource-status";

describe("cluster resource status helpers", () => {
  it("builds node device rows from NodeResourceStatus devices", () => {
    const nodeResources: Record<string, NodeResourceStatus> = {
      "node-a": {
        allocatable: {
          cpu: 16,
          memory: 64,
          accelerator_groups: null,
        },
        available: {
          cpu: 12,
          memory: 48,
          accelerator_groups: null,
        },
        devices: [
          {
            uuid: "GPU-1",
            product: "Tesla-T4",
            health: true,
            allocatable: {
              memory_mib: 15360,
              core_units: 100,
              slots: 10,
            },
            available: {
              memory_mib: 7680,
              core_units: 50,
              slots: 5,
            },
          },
        ],
      },
      "node-b": {
        allocatable: null,
        available: null,
        devices: [
          {
            uuid: "GPU-2",
            product: "Tesla-A10",
            health: false,
          },
        ],
      },
    };

    expect(getNodeDeviceResourceRows(nodeResources)).toEqual([
      {
        nodeName: "node-a",
        uuid: "GPU-1",
        product: "Tesla-T4",
        healthy: true,
        allocatableMemoryMiB: 15360,
        availableMemoryMiB: 7680,
        allocatableCoreUnits: 100,
        availableCoreUnits: 50,
        allocatableSlots: 10,
        availableSlots: 5,
      },
      {
        nodeName: "node-b",
        uuid: "GPU-2",
        product: "Tesla-A10",
        healthy: false,
        allocatableMemoryMiB: null,
        availableMemoryMiB: null,
        allocatableCoreUnits: null,
        availableCoreUnits: null,
        allocatableSlots: null,
        availableSlots: null,
      },
    ]);
  });

  it("returns an empty array when no node has device resources", () => {
    expect(
      getNodeDeviceResourceRows({
        "node-a": {
          allocatable: null,
          available: null,
        },
      }),
    ).toEqual([]);
  });

  it("derives accelerator product quantities from products when product_groups is absent", () => {
    expect(
      getAcceleratorProductQuantities({
        quantity: 2,
        product_groups: null,
        products: {
          "Tesla-T4": {
            quantity: 2,
            virtualization: {
              memory_mib: 30720,
              core_units: 200,
            },
          },
        },
      }),
    ).toEqual({ "Tesla-T4": 2 });
  });
});
