import { describe, expect, it } from "vitest";
import type { NodeResourceStatus } from "@/foundation/types/resource-types";
import {
  addBackEndpointDeviceAllocationsToNodeResources,
  buildGpuCardResourceRows,
  buildGpuDeviceResourceRows,
  buildNodePhysicalGpuResourceRows,
  calculatePhysicalCardUsageForRequest,
  calculateVgpuCardCapacity,
  calculateVgpuDevicePlacementCapacity,
  calculateVgpuMemoryBoundaryMiB,
  filterGpuDeviceResourceRows,
  sumMatchingDeviceAvailableResources,
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
  it("adds current endpoint device allocations back to matching node devices", () => {
    const result = addBackEndpointDeviceAllocationsToNodeResources(
      {
        "node-a": {
          allocatable: null,
          available: null,
          devices: [
            {
              uuid: "GPU-current",
              product: "Tesla-T4",
              health: true,
              allocatable: { memory_mib: 15360, core_units: 100 },
              available: { memory_mib: 7680, core_units: 50 },
            },
            {
              uuid: "GPU-other",
              product: "Tesla-T4",
              health: true,
              allocatable: { memory_mib: 15360, core_units: 100 },
              available: { memory_mib: 15360, core_units: 100 },
            },
          ],
        },
      },
      {
        replicas: [
          {
            instance_id: "endpoint-a",
            node_id: "node-a",
            devices: [
              {
                uuid: "GPU-current",
                product: "Tesla-T4",
                memory_mib: 8192,
                core_units: 60,
                node_id: "node-a",
              },
            ],
          },
        ],
      },
      { type: "nvidia_gpu", product: "Tesla-T4" },
    );

    expect(result?.["node-a"]?.devices?.[0]?.available).toEqual({
      memory_mib: 15360,
      core_units: 100,
    });
    expect(result?.["node-a"]?.devices?.[1]?.available).toEqual({
      memory_mib: 15360,
      core_units: 100,
    });
  });

  it("calculates fractional GPU card usage with physical-card semantics", () => {
    expect(
      calculatePhysicalCardUsageForRequest(
        {
          "node-a": {
            allocatable: null,
            available: null,
            devices: [
              {
                uuid: "GPU-fit",
                product: "Tesla-T4",
                health: true,
                allocatable: { memory_mib: 15360, core_units: 100 },
                available: { memory_mib: 7680, core_units: 50 },
              },
              {
                uuid: "GPU-too-small",
                product: "Tesla-T4",
                health: true,
                allocatable: { memory_mib: 15360, core_units: 100 },
                available: { memory_mib: 4096, core_units: 50 },
              },
            ],
          },
        },
        {
          allocationMode: "fractional",
          selectedAccelerator: { type: "nvidia_gpu", product: "Tesla-T4" },
          requestedPerReplica: 0.5,
          replicaCount: 2,
        },
      ),
    ).toEqual({
      available: 1,
      placementCapacity: 1,
      requested: 1,
      total: 1,
      used: 1,
    });
  });

  it("calculates fractional GPU placement slots per physical card", () => {
    expect(
      calculatePhysicalCardUsageForRequest(
        {
          "node-a": {
            allocatable: null,
            available: null,
            devices: [
              {
                uuid: "GPU-a",
                product: "Tesla-T4",
                health: true,
                allocatable: { memory_mib: 15360, core_units: 100 },
                available: { memory_mib: 9216, core_units: 60 },
              },
              {
                uuid: "GPU-b",
                product: "Tesla-T4",
                health: true,
                allocatable: { memory_mib: 15360, core_units: 100 },
                available: { memory_mib: 9216, core_units: 60 },
              },
            ],
          },
        },
        {
          allocationMode: "fractional",
          selectedAccelerator: { type: "nvidia_gpu", product: "Tesla-T4" },
          requestedPerReplica: 0.5,
          replicaCount: 3,
        },
      ),
    ).toEqual({
      available: 2,
      placementCapacity: 2,
      requested: 1.5,
      total: 2,
      used: 1.5,
    });
  });

  it("allows multiple fractional GPU replicas on one card when capacity fits", () => {
    expect(
      calculatePhysicalCardUsageForRequest(
        {
          "node-a": {
            allocatable: null,
            available: null,
            devices: [
              {
                uuid: "GPU-a",
                product: "Tesla-T4",
                health: true,
                allocatable: { memory_mib: 15360, core_units: 100 },
                available: { memory_mib: 15360, core_units: 100 },
              },
            ],
          },
        },
        {
          allocationMode: "fractional",
          selectedAccelerator: { type: "nvidia_gpu", product: "Tesla-T4" },
          requestedPerReplica: 0.5,
          replicaCount: 2,
        },
      ),
    ).toEqual({
      available: 1,
      placementCapacity: 2,
      requested: 1,
      total: 1,
      used: 1,
    });
  });

  it("calculates vGPU card count by spread-style physical-card count", () => {
    expect(
      calculatePhysicalCardUsageForRequest(
        {
          "node-a": {
            allocatable: null,
            available: null,
            devices: [
              {
                uuid: "GPU-a",
                product: "Tesla-T4",
                health: true,
                allocatable: { memory_mib: 15360, core_units: 100 },
                available: { memory_mib: 8192, core_units: 100 },
              },
              {
                uuid: "GPU-b",
                product: "Tesla-T4",
                health: true,
                allocatable: { memory_mib: 15360, core_units: 100 },
                available: { memory_mib: 4096, core_units: 50 },
              },
            ],
          },
        },
        {
          allocationMode: "vgpu",
          selectedAccelerator: { type: "nvidia_gpu", product: "Tesla-T4" },
          requestedPerReplica: 3,
          replicaCount: 1,
          memoryMiBPerCard: 4096,
          coreUnitsPerCard: 50,
        },
      ),
    ).toEqual({
      available: 2,
      placementCapacity: 2,
      requested: 3,
      total: 2,
      used: 2,
    });
  });

  it("calculates vGPU placement capacity from per-device memory slots", () => {
    const l20NodeResources = {
      "node-a": {
        allocatable: null,
        available: null,
        devices: [
          {
            uuid: "GPU-a",
            product: "NVIDIA-L20",
            health: true,
            allocatable: { memory_mib: 46068, core_units: 100 },
            available: { memory_mib: 46068, core_units: 100 },
          },
          {
            uuid: "GPU-b",
            product: "NVIDIA-L20",
            health: true,
            allocatable: { memory_mib: 46068, core_units: 100 },
            available: { memory_mib: 46068, core_units: 100 },
          },
        ],
      },
    };

    expect(
      calculateVgpuDevicePlacementCapacity(l20NodeResources, {
        selectedAccelerator: { type: "nvidia_gpu", product: "NVIDIA-L20" },
        memoryMiBPerCard: 30 * 1024,
        coreUnitsPerCard: 0,
      }),
    ).toBe(2);

    expect(
      calculateVgpuDevicePlacementCapacity(l20NodeResources, {
        selectedAccelerator: { type: "nvidia_gpu", product: "NVIDIA-L20" },
        memoryMiBPerCard: 20 * 1024,
        coreUnitsPerCard: 0,
      }),
    ).toBe(4);
  });

  it("calculates vGPU placement capacity from per-device memory and core slots", () => {
    expect(
      calculateVgpuDevicePlacementCapacity(
        {
          "node-a": {
            allocatable: null,
            available: null,
            devices: [
              {
                uuid: "GPU-a",
                product: "NVIDIA-L20",
                health: true,
                allocatable: { memory_mib: 46068, core_units: 100 },
                available: { memory_mib: 46068, core_units: 100 },
              },
              {
                uuid: "GPU-b",
                product: "NVIDIA-L20",
                health: true,
                allocatable: { memory_mib: 46068, core_units: 100 },
                available: { memory_mib: 46068, core_units: 100 },
              },
            ],
          },
        },
        {
          selectedAccelerator: { type: "nvidia_gpu", product: "NVIDIA-L20" },
          memoryMiBPerCard: 20 * 1024,
          coreUnitsPerCard: 60,
        },
      ),
    ).toBe(2);
  });

  it("sums matching device resources after endpoint allocation reuse", () => {
    const reusable = addBackEndpointDeviceAllocationsToNodeResources(
      {
        "node-a": {
          allocatable: null,
          available: null,
          devices: [
            {
              uuid: "GPU-current",
              product: "Tesla-T4",
              health: true,
              allocatable: { memory_mib: 15360, core_units: 100 },
              available: { memory_mib: 7680, core_units: 50 },
            },
          ],
        },
      },
      {
        replicas: [
          {
            instance_id: "endpoint-a",
            node_id: "node-a",
            devices: [
              {
                uuid: "GPU-current",
                product: "Tesla-T4",
                memory_mib: 4096,
                core_units: 25,
                node_id: "node-a",
              },
            ],
          },
        ],
      },
      { type: "nvidia_gpu", product: "Tesla-T4" },
    );

    expect(
      sumMatchingDeviceAvailableResources(reusable, {
        type: "nvidia_gpu",
        product: "Tesla-T4",
      }),
    ).toEqual({
      coreUnits: 75,
      memoryMiB: 11776,
    });
  });

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

  it("falls back to product groups when card-level products is empty", () => {
    expect(
      buildGpuCardResourceRows({
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
              product_groups: { "Tesla-T4": 2 },
              products: {},
            },
          },
        },
        available: {
          cpu: 24,
          memory: 96,
          accelerator_groups: {
            nvidia_gpu: {
              quantity: 1,
              product_groups: { "Tesla-T4": 1 },
              products: {},
            },
          },
        },
        node_resources: {
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
      }),
    ).toEqual([
      {
        acceleratorType: "nvidia_gpu",
        product: "Tesla-T4",
        matchesSelectedAccelerator: true,
        memoryTotalMiB: 15360,
        quantity: {
          available: 1,
          total: 2,
          used: 1,
          percent: 50,
        },
        memory: {
          available: 15360,
          total: 15360,
          used: 0,
          percent: 0,
        },
        core: {
          available: 100,
          total: 100,
          used: 0,
          percent: 0,
        },
      },
    ]);
  });

  it("builds a generic card row when product breakdown is missing", () => {
    expect(
      buildGpuCardResourceRows({
        allocatable: {
          cpu: 32,
          memory: 128,
          accelerator_groups: {
            nvidia_gpu: {
              quantity: 2,
              product_groups: null,
              products: null,
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
              products: null,
            },
          },
        },
        node_resources: null,
      }),
    ).toEqual([
      {
        acceleratorType: "nvidia_gpu",
        product: "",
        matchesSelectedAccelerator: true,
        memoryTotalMiB: undefined,
        quantity: {
          available: 1,
          total: 2,
          used: 1,
          percent: 50,
        },
        memory: {
          available: null,
          total: null,
          used: null,
          percent: 0,
        },
        core: {
          available: null,
          total: null,
          used: null,
          percent: 0,
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

  it("does not fall back to product availability when device full-card signals are incomplete", () => {
    expect(
      buildGpuCardResourceRows({
        allocatable: {
          cpu: 32,
          memory: 128,
          accelerator_groups: {
            nvidia_gpu: {
              quantity: 1,
              product_groups: null,
              products: {
                "Tesla-T4": {
                  quantity: 1,
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
                },
              },
            },
          },
        },
        node_resources: {
          "node-a": {
            allocatable: null,
            available: null,
            devices: [
              {
                uuid: "GPU-missing-available",
                product: "Tesla-T4",
                health: true,
                allocatable: {
                  memory_mib: 15360,
                  core_units: 100,
                },
                available: null,
              },
            ],
          },
        },
      })[0].quantity,
    ).toEqual({
      available: 0,
      total: 1,
      used: 1,
      percent: 100,
    });
  });

  it("does not treat unknown available device resources as fully used", () => {
    const row = buildGpuDeviceResourceRows({
      "node-a": {
        allocatable: null,
        available: null,
        devices: [
          {
            uuid: "GPU-unknown",
            product: "Tesla-T4",
            health: true,
            allocatable: {
              memory_mib: 15360,
              core_units: 100,
            },
            available: null,
          },
        ],
      },
    })[0];

    expect(row.memory).toEqual({
      available: null,
      total: 15360,
      used: null,
      percent: 0,
    });
    expect(row.core).toEqual({
      available: null,
      total: 100,
      used: null,
      percent: 0,
    });
  });

  it("excludes unhealthy devices from device-level accelerator pools", () => {
    const rows = buildGpuCardResourceRows({
      allocatable: {
        cpu: 32,
        memory: 128,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 2,
            product_groups: { "Tesla-T4": 2 },
          },
        },
      },
      available: {
        cpu: 24,
        memory: 96,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 2,
            product_groups: { "Tesla-T4": 2 },
          },
        },
      },
      node_resources: {
        "node-a": {
          allocatable: null,
          available: null,
          devices: [
            {
              uuid: "GPU-healthy",
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
              uuid: "GPU-unhealthy",
              product: "Tesla-T4",
              health: false,
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
    });

    expect(rows[0].memory).toEqual({
      available: 4096,
      total: 15360,
      used: 11264,
      percent: 73,
    });
    expect(rows[0].core).toEqual({
      available: 10,
      total: 100,
      used: 90,
      percent: 90,
    });
    expect(rows[0].quantity.available).toBe(0);
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
        gpuNumber: 1,
        product: "Tesla-T4",
        healthy: true,
        fullFree: false,
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
        gpuNumber: 1,
        product: "Tesla-A10",
        healthy: false,
        fullFree: false,
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

  it("treats GPU devices as matching when no accelerator is selected", () => {
    const rows = buildGpuDeviceResourceRows(nodeResources);

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.matchesSelectedAccelerator)).toBe(true);
  });

  it("matches bare recipe-style product names against vendor-prefixed cluster products", () => {
    // A recipe/catalog preset uses bare model names ("T4") while the cluster
    // reports decorated products ("Tesla-T4") — the two schemes must line up
    // instead of filtering every row out (NEU-501).
    const rows = buildGpuDeviceResourceRows(nodeResources, {
      type: "nvidia_gpu",
      product: "T4",
    });

    expect(
      rows.map((row) => [row.product, row.matchesSelectedAccelerator]),
    ).toEqual([
      ["Tesla-T4", true],
      ["Tesla-A10", false],
    ]);
  });

  it("builds node physical GPU rows without device-level details", () => {
    expect(
      buildNodePhysicalGpuResourceRows(
        {
          "node-b": {
            allocatable: {
              cpu: 16,
              memory: 64,
              accelerator_groups: {
                nvidia_gpu: {
                  quantity: 2,
                  product_groups: { "Tesla-T4": 1, "Tesla-A10": 1 },
                },
              },
            },
            available: {
              cpu: 10,
              memory: 48,
              accelerator_groups: {
                nvidia_gpu: {
                  quantity: 1,
                  product_groups: { "Tesla-T4": 0, "Tesla-A10": 1 },
                },
              },
            },
          },
          "node-a": {
            allocatable: {
              cpu: 8,
              memory: 32,
              accelerator_groups: {
                nvidia_gpu: {
                  quantity: 2,
                  product_groups: null,
                  products: {
                    "Tesla-T4": { quantity: 2 },
                  },
                },
              },
            },
            available: {
              cpu: 6,
              memory: 24,
              accelerator_groups: {
                nvidia_gpu: {
                  quantity: 1,
                  product_groups: null,
                  products: {
                    "Tesla-T4": { quantity: 1 },
                  },
                },
              },
            },
          },
        },
        {
          type: "nvidia_gpu",
          product: "Tesla-T4",
        },
      ),
    ).toEqual([
      {
        cpu: {
          available: 6,
          percent: 25,
          total: 8,
          used: 2,
        },
        memory: {
          available: 24,
          percent: 25,
          total: 32,
          used: 8,
        },
        nodeName: "node-a",
        quantity: {
          available: 1,
          percent: 50,
          total: 2,
          used: 1,
        },
      },
      {
        cpu: {
          available: 10,
          percent: 38,
          total: 16,
          used: 6,
        },
        memory: {
          available: 48,
          percent: 25,
          total: 64,
          used: 16,
        },
        nodeName: "node-b",
        quantity: {
          available: 0,
          percent: 100,
          total: 1,
          used: 1,
        },
      },
    ]);
  });

  it("orders GPU devices by physical order within each node", () => {
    const rows = buildGpuDeviceResourceRows({
      "node-a": {
        allocatable: null,
        available: null,
        devices: [
          {
            uuid: "GPU-node-a-bbbbbbbb",
            order: 1,
            product: "Tesla-T4",
            health: true,
            allocatable: { memory_mib: 15360, core_units: 100 },
            available: { memory_mib: 15360, core_units: 100 },
          },
          {
            uuid: "GPU-node-a-aaaaaaaa",
            order: 0,
            product: "Tesla-T4",
            health: true,
            allocatable: { memory_mib: 15360, core_units: 100 },
            available: { memory_mib: 15360, core_units: 100 },
          },
        ],
      },
      "node-b": {
        allocatable: null,
        available: null,
        devices: [
          {
            uuid: "GPU-node-b-cccccccc",
            order: 0,
            product: "Tesla-T4",
            health: true,
            allocatable: { memory_mib: 15360, core_units: 100 },
            available: { memory_mib: 15360, core_units: 100 },
          },
        ],
      },
    });

    expect(
      rows.map((row) => ({
        gpuNumber: row.gpuNumber,
        nodeName: row.nodeName,
        uuid: row.uuid,
      })),
    ).toEqual([
      {
        gpuNumber: 0,
        nodeName: "node-a",
        uuid: "GPU-node-a-aaaaaaaa",
      },
      {
        gpuNumber: 1,
        nodeName: "node-a",
        uuid: "GPU-node-a-bbbbbbbb",
      },
      {
        gpuNumber: 0,
        nodeName: "node-b",
        uuid: "GPU-node-b-cccccccc",
      },
    ]);
  });

  it("falls back to UUID order when GPU device order is missing", () => {
    const rows = buildGpuDeviceResourceRows({
      "node-a": {
        allocatable: null,
        available: null,
        devices: [
          {
            uuid: "GPU-node-a-bbbbbbbb",
            product: "Tesla-T4",
            health: true,
            allocatable: { memory_mib: 15360, core_units: 100 },
            available: { memory_mib: 15360, core_units: 100 },
          },
          {
            uuid: "GPU-node-a-aaaaaaaa",
            product: "Tesla-T4",
            health: true,
            allocatable: { memory_mib: 15360, core_units: 100 },
            available: { memory_mib: 15360, core_units: 100 },
          },
        ],
      },
    });

    expect(
      rows.map((row) => ({
        gpuNumber: row.gpuNumber,
        nodeName: row.nodeName,
        uuid: row.uuid,
      })),
    ).toEqual([
      {
        gpuNumber: 1,
        nodeName: "node-a",
        uuid: "GPU-node-a-aaaaaaaa",
      },
      {
        gpuNumber: 2,
        nodeName: "node-a",
        uuid: "GPU-node-a-bbbbbbbb",
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

  it("clamps out-of-range device resource pools and treats non-finite values as unknown", () => {
    const rows = buildGpuDeviceResourceRows({
      "node-a": {
        allocatable: null,
        available: null,
        devices: [
          {
            uuid: "GPU-over-available",
            product: "Tesla-T4",
            health: true,
            allocatable: {
              memory_mib: 15360,
              core_units: 100,
            },
            available: {
              memory_mib: 20000,
              core_units: -10,
            },
          },
          {
            uuid: "GPU-non-finite",
            product: "Tesla-T4",
            health: true,
            allocatable: {
              memory_mib: Number.NaN,
              core_units: 100,
            },
            available: {
              memory_mib: 1000,
              core_units: Number.POSITIVE_INFINITY,
            },
          },
        ],
      },
    });

    const overAvailableRow = rows.find(
      (row) => row.uuid === "GPU-over-available",
    );
    const nonFiniteRow = rows.find((row) => row.uuid === "GPU-non-finite");

    expect(overAvailableRow?.memory).toEqual({
      available: 15360,
      total: 15360,
      used: 0,
      percent: 0,
    });
    expect(overAvailableRow?.core).toEqual({
      available: 0,
      total: 100,
      used: 100,
      percent: 100,
    });
    expect(nonFiniteRow?.memory).toEqual({
      available: 1000,
      total: null,
      used: null,
      percent: 0,
    });
    expect(nonFiniteRow?.core).toEqual({
      available: null,
      total: 100,
      used: null,
      percent: 0,
    });
  });

  it("calculates virtual card capacity from device-level available pools", () => {
    expect(
      calculateVgpuCardCapacity(nodeResources, {
        selectedAccelerator: {
          type: "nvidia_gpu",
          product: "Tesla-T4",
        },
        memoryMiBPerCard: 4096,
        coreUnitsPerCard: 50,
      }),
    ).toEqual({
      matchingDeviceCount: 1,
      totalCards: 1,
    });
  });

  it("caps vGPU capacity at usable physical card count", () => {
    expect(
      calculateVgpuCardCapacity(
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
          memoryMiBPerCard: 4096,
          coreUnitsPerCard: 10,
        },
      ),
    ).toEqual({
      matchingDeviceCount: 1,
      totalCards: 1,
    });
  });

  it("excludes cards whose memory or core pool is fully allocated from vGPU capacity", () => {
    expect(
      calculateVgpuCardCapacity(
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
          memoryMiBPerCard: 4096,
          coreUnitsPerCard: 10,
        },
      ),
    ).toEqual({
      matchingDeviceCount: 3,
      totalCards: 1,
    });
  });

  it("excludes unhealthy cards from vGPU capacity", () => {
    expect(
      calculateVgpuCardCapacity(
        {
          "node-a": {
            allocatable: null,
            available: null,
            devices: [
              {
                uuid: "GPU-healthy",
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
                uuid: "GPU-unhealthy",
                product: "Tesla-T4",
                health: false,
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
          memoryMiBPerCard: 4096,
          coreUnitsPerCard: 10,
        },
      ),
    ).toEqual({
      matchingDeviceCount: 1,
      totalCards: 1,
    });
  });

  it("treats zero vGPU core percent as unconfigured while still requiring remaining core on the card", () => {
    expect(
      calculateVgpuCardCapacity(
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
          memoryMiBPerCard: 4096,
          coreUnitsPerCard: 0,
        },
      ),
    ).toEqual({
      matchingDeviceCount: 2,
      totalCards: 1,
    });
  });

  it("calculates the largest per-card vGPU memory boundary from usable devices", () => {
    const fragmentedL20Resources = {
      "node-l20": {
        allocatable: null,
        available: null,
        devices: [
          {
            uuid: "GPU-l20-low-memory",
            product: "NVIDIA-L20",
            health: true,
            allocatable: {
              memory_mib: 46068,
              core_units: 100,
            },
            available: {
              memory_mib: 1012,
              core_units: 30,
            },
          },
          {
            uuid: "GPU-l20-rounded-seven-gib",
            product: "NVIDIA-L20",
            health: true,
            allocatable: {
              memory_mib: 46068,
              core_units: 100,
            },
            available: {
              memory_mib: 7156,
              core_units: 15,
            },
          },
        ],
      },
    } satisfies Record<string, NodeResourceStatus>;

    expect(
      calculateVgpuMemoryBoundaryMiB(fragmentedL20Resources, {
        selectedAccelerator: {
          type: "nvidia_gpu",
          product: "NVIDIA-L20",
        },
        requestedCardCount: 1,
        coreUnitsPerCard: 0,
      }),
    ).toBe(7156);
    expect(
      calculateVgpuMemoryBoundaryMiB(fragmentedL20Resources, {
        selectedAccelerator: {
          type: "nvidia_gpu",
          product: "NVIDIA-L20",
        },
        requestedCardCount: 2,
        coreUnitsPerCard: 0,
      }),
    ).toBe(1012);
  });

  it("counts vGPU card capacity with displayed GiB memory alignment", () => {
    const fragmentedL20Resources = {
      "node-l20": {
        allocatable: null,
        available: null,
        devices: [
          {
            uuid: "GPU-l20-low-memory",
            product: "NVIDIA-L20",
            health: true,
            allocatable: {
              memory_mib: 46068,
              core_units: 100,
            },
            available: {
              memory_mib: 1012,
              core_units: 40,
            },
          },
          {
            uuid: "GPU-l20-rounded-seven-gib",
            product: "NVIDIA-L20",
            health: true,
            allocatable: {
              memory_mib: 46068,
              core_units: 100,
            },
            available: {
              memory_mib: 7156,
              core_units: 50,
            },
          },
        ],
      },
    } satisfies Record<string, NodeResourceStatus>;

    expect(
      calculateVgpuCardCapacity(fragmentedL20Resources, {
        selectedAccelerator: {
          type: "nvidia_gpu",
          product: "NVIDIA-L20",
        },
        memoryMiBPerCard: 1024,
        coreUnitsPerCard: 0,
      }),
    ).toEqual({
      matchingDeviceCount: 2,
      totalCards: 2,
    });

    expect(
      calculateVgpuCardCapacity(fragmentedL20Resources, {
        selectedAccelerator: {
          type: "nvidia_gpu",
          product: "NVIDIA-L20",
        },
        memoryMiBPerCard: 1024,
        coreUnitsPerCard: 45,
      }),
    ).toEqual({
      matchingDeviceCount: 2,
      totalCards: 1,
    });
  });
});
