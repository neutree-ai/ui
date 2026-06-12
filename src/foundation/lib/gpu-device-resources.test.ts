import { describe, expect, it } from "vitest";
import type { NodeResourceStatus } from "@/foundation/types/resource-types";
import {
  buildGpuCardResourceRows,
  buildGpuDeviceResourceRows,
  calculateVgpuSliceCapacity,
  filterGpuDeviceResourceRows,
} from "./gpu-device-resources";

const nodeResources: Record<string, NodeResourceStatus> = {
  "node-a": {
    allocatable: {
      cpu: 16,
      memory: 64,
      accelerator_groups: {
        nvidia_gpu: {
          quantity: 1,
          product_groups: null,
          products: {
            "Tesla-T4": {
              quantity: 1,
              virtualization: {
                memory_mib: 15360,
                core_units: 100,
              },
            },
          },
        },
      },
    },
    available: {
      cpu: 12,
      memory: 48,
      accelerator_groups: {
        nvidia_gpu: {
          quantity: 1,
          product_groups: null,
          products: {
            "Tesla-T4": {
              quantity: 1,
              virtualization: {
                memory_mib: 7680,
                core_units: 50,
              },
            },
          },
        },
      },
    },
    devices: [
      {
        uuid: "GPU-11111111-2222-3333-4444-555555555555",
        product: "Tesla-T4",
        health: true,
        allocatable: {
          memory_mib: 15360,
          core_units: 100,
        },
        available: {
          memory_mib: 7680,
          core_units: 50,
        },
      },
    ],
  },
  "node-b": {
    allocatable: {
      cpu: 16,
      memory: 64,
      accelerator_groups: {
        nvidia_gpu: {
          quantity: 1,
          product_groups: { "Tesla-A10": 1 },
        },
      },
    },
    available: {
      cpu: 12,
      memory: 48,
      accelerator_groups: {
        nvidia_gpu: {
          quantity: 1,
          product_groups: { "Tesla-A10": 1 },
        },
      },
    },
    devices: [
      {
        uuid: "GPU-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        product: "Tesla-A10",
        health: false,
        allocatable: {
          memory_mib: 24576,
          core_units: 100,
        },
        available: {
          memory_mib: 12288,
          core_units: 75,
        },
      },
    ],
  },
};

describe("gpu device resource helpers", () => {
  it("builds card-level GPU resource rows from cluster resources", () => {
    expect(
      buildGpuCardResourceRows(
        {
          accelerator_metadata: {
            nvidia_gpu: {
              products: {
                "Tesla-T4": { memory_total_mib: 15360 },
              },
            },
          },
          allocatable: {
            cpu: 32,
            memory: 128,
            accelerator_groups: {
              nvidia_gpu: {
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
              },
            },
          },
          available: {
            cpu: 24,
            memory: 96,
            accelerator_groups: {
              nvidia_gpu: {
                quantity: 1,
                product_groups: null,
                products: {
                  "Tesla-T4": {
                    quantity: 1,
                    virtualization: {
                      memory_mib: 15360,
                      core_units: 150,
                    },
                  },
                },
              },
            },
          },
          node_resources: nodeResources,
        },
        {
          type: "nvidia_gpu",
          product: "Tesla-T4",
        },
      ),
    ).toEqual([
      {
        acceleratorType: "nvidia_gpu",
        product: "Tesla-T4",
        matchesSelectedAccelerator: true,
        memoryTotalMiB: 15360,
        quantity: {
          available: 0,
          total: 2,
          used: 2,
          percent: 100,
        },
        memory: {
          available: 15360,
          total: 30720,
          used: 15360,
          percent: 50,
        },
        core: {
          available: 150,
          total: 200,
          used: 50,
          percent: 25,
        },
      },
    ]);
  });

  it("counts only devices with no vGPU allocation as full-card available", () => {
    expect(
      buildGpuCardResourceRows({
        allocatable: {
          cpu: 32,
          memory: 128,
          accelerator_groups: {
            nvidia_gpu: {
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
            },
          },
        },
        available: {
          cpu: 24,
          memory: 96,
          accelerator_groups: {
            nvidia_gpu: {
              quantity: 2,
              product_groups: null,
              products: {
                "Tesla-T4": {
                  quantity: 2,
                  virtualization: {
                    memory_mib: 23040,
                    core_units: 150,
                  },
                },
              },
            },
          },
        },
        node_resources: {
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
                uuid: "GPU-full",
                product: "Tesla-T4",
                health: true,
                allocatable: {
                  memory_mib: 15360,
                  core_units: 100,
                },
                available: {
                  memory_mib: 15360,
                  core_units: 100,
                },
              },
              {
                uuid: "GPU-vgpu-used",
                product: "Tesla-T4",
                health: true,
                allocatable: {
                  memory_mib: 15360,
                  core_units: 100,
                },
                available: {
                  memory_mib: 7680,
                  core_units: 50,
                },
              },
            ],
          },
        },
      })[0].quantity,
    ).toEqual({
      available: 1,
      total: 2,
      used: 1,
      percent: 50,
    });
  });

  it("builds used-over-total GPU device rows from node resources", () => {
    expect(
      buildGpuDeviceResourceRows(nodeResources, {
        type: "nvidia_gpu",
        product: "Tesla-T4",
      }),
    ).toEqual([
      {
        acceleratorType: "nvidia_gpu",
        nodeName: "node-a",
        uuid: "GPU-11111111-2222-3333-4444-555555555555",
        shortUuid: "GPU-1111...555555",
        product: "Tesla-T4",
        healthy: true,
        matchesSelectedAccelerator: true,
        memory: {
          available: 7680,
          total: 15360,
          used: 7680,
          percent: 50,
        },
        core: {
          available: 50,
          total: 100,
          used: 50,
          percent: 50,
        },
      },
      {
        acceleratorType: "nvidia_gpu",
        nodeName: "node-b",
        uuid: "GPU-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        shortUuid: "GPU-aaaa...eeeeee",
        product: "Tesla-A10",
        healthy: false,
        matchesSelectedAccelerator: false,
        memory: {
          available: 12288,
          total: 24576,
          used: 12288,
          percent: 50,
        },
        core: {
          available: 75,
          total: 100,
          used: 25,
          percent: 25,
        },
      },
    ]);
  });

  it("filters GPU device rows by node, product, and search text", () => {
    const rows = buildGpuDeviceResourceRows(nodeResources);

    expect(
      filterGpuDeviceResourceRows(rows, {
        nodeName: "node-a",
        product: "Tesla-T4",
        search: "5555",
      }).map((row) => row.uuid),
    ).toEqual(["GPU-11111111-2222-3333-4444-555555555555"]);
  });

  it("does not expose vGPU slot fields in the device view model", () => {
    const row = buildGpuDeviceResourceRows(nodeResources)[0];

    expect(
      Object.keys(row).some((key) => key.toLowerCase().includes("slot")),
    ).toBe(false);
  });

  it("calculates vGPU slice capacity from device-level available pools", () => {
    expect(
      calculateVgpuSliceCapacity(nodeResources, {
        selectedAccelerator: {
          type: "nvidia_gpu",
          product: "Tesla-T4",
        },
        memoryMiBPerSlice: 4096,
        coreUnitsPerSlice: 50,
      }),
    ).toEqual({
      matchingDeviceCount: 1,
      totalSlices: 1,
    });
  });

  it("caps vGPU capacity at usable physical card count", () => {
    expect(
      calculateVgpuSliceCapacity(
        {
          "node-a": {
            allocatable: null,
            available: null,
            devices: [
              {
                uuid: "GPU-free",
                product: "Tesla-T4",
                health: true,
                allocatable: {
                  memory_mib: 15360,
                  core_units: 100,
                },
                available: {
                  memory_mib: 15360,
                  core_units: 100,
                },
              },
            ],
          },
        },
        {
          selectedAccelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
          },
          memoryMiBPerSlice: 4096,
          coreUnitsPerSlice: 10,
        },
      ),
    ).toEqual({
      matchingDeviceCount: 1,
      totalSlices: 1,
    });
  });

  it("excludes cards whose memory or core pool is fully allocated from vGPU capacity", () => {
    expect(
      calculateVgpuSliceCapacity(
        {
          "node-a": {
            allocatable: null,
            available: null,
            devices: [
              {
                uuid: "GPU-usable",
                product: "Tesla-T4",
                health: true,
                allocatable: {
                  memory_mib: 15360,
                  core_units: 100,
                },
                available: {
                  memory_mib: 4096,
                  core_units: 10,
                },
              },
              {
                uuid: "GPU-memory-full",
                product: "Tesla-T4",
                health: true,
                allocatable: {
                  memory_mib: 15360,
                  core_units: 100,
                },
                available: {
                  memory_mib: 0,
                  core_units: 100,
                },
              },
              {
                uuid: "GPU-core-full",
                product: "Tesla-T4",
                health: true,
                allocatable: {
                  memory_mib: 15360,
                  core_units: 100,
                },
                available: {
                  memory_mib: 15360,
                  core_units: 0,
                },
              },
            ],
          },
        },
        {
          selectedAccelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
          },
          memoryMiBPerSlice: 4096,
          coreUnitsPerSlice: 10,
        },
      ),
    ).toEqual({
      matchingDeviceCount: 3,
      totalSlices: 1,
    });
  });

  it("treats zero vGPU core percent as unconfigured while still requiring remaining core on the card", () => {
    expect(
      calculateVgpuSliceCapacity(
        {
          "node-a": {
            allocatable: null,
            available: null,
            devices: [
              {
                uuid: "GPU-shared-core",
                product: "Tesla-T4",
                health: true,
                allocatable: {
                  memory_mib: 15360,
                  core_units: 100,
                },
                available: {
                  memory_mib: 8192,
                  core_units: 10,
                },
              },
              {
                uuid: "GPU-core-full",
                product: "Tesla-T4",
                health: true,
                allocatable: {
                  memory_mib: 15360,
                  core_units: 100,
                },
                available: {
                  memory_mib: 8192,
                  core_units: 0,
                },
              },
            ],
          },
        },
        {
          selectedAccelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
          },
          memoryMiBPerSlice: 4096,
          coreUnitsPerSlice: 0,
        },
      ),
    ).toEqual({
      matchingDeviceCount: 2,
      totalSlices: 1,
    });
  });
});
