import { describe, expect, it } from "vitest";
import type {
  ClusterResourceInfo,
  NodeResourceStatus,
  ResourceStatus,
} from "@/foundation/types/resource-types";
import {
  cachePoolResources,
  findBestNodeForAccelerator,
  parseClusterResources,
} from "./cluster-resources";

const mockTranslate = (type: string) => {
  const translations: Record<string, string> = {
    nvidia_gpu: "NVIDIA GPU",
    amd_gpu: "AMD GPU",
  };
  return translations[type] || type;
};

describe("parseClusterResources", () => {
  it("should return null summary when resourceInfo is undefined", () => {
    const result = parseClusterResources(undefined, mockTranslate);
    expect(result.summary).toBeNull();
    expect(result.acceleratorOptions).toEqual([]);
  });

  it("should return null summary when resourceInfo is null", () => {
    const result = parseClusterResources(null, mockTranslate);
    expect(result.summary).toBeNull();
  });

  it("should parse basic CPU and memory resources", () => {
    const resourceInfo: ClusterResourceInfo = {
      allocatable: {
        cpu: 100,
        memory: 256,
        accelerator_groups: null,
      },
      available: {
        cpu: 80,
        memory: 200,
        accelerator_groups: null,
      },
      node_resources: null,
    };

    const result = parseClusterResources(resourceInfo, mockTranslate);
    expect(result.summary).toEqual({
      cpu: { available: 80, total: 100 },
      memory: { available: 200, total: 256 },
    });
  });

  it("should parse accelerator options with product groups", () => {
    const resourceInfo: ClusterResourceInfo = {
      allocatable: {
        cpu: 100,
        memory: 256,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 8,
            product_groups: {
              "Tesla-T4": 4,
              "Tesla-V100": 4,
            },
          },
        },
      },
      available: {
        cpu: 80,
        memory: 200,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 6,
            product_groups: {
              "Tesla-T4": 3,
              "Tesla-V100": 3,
            },
          },
        },
      },
      node_resources: null,
    };

    const result = parseClusterResources(resourceInfo, mockTranslate);
    expect(result.acceleratorOptions).toHaveLength(2);
    expect(result.acceleratorOptions).toContainEqual({
      label: "NVIDIA GPU - Tesla-T4",
      value: "nvidia_gpu:Tesla-T4",
      type: "nvidia_gpu",
      product: "Tesla-T4",
      available: 3,
      total: 4,
    });
    expect(result.acceleratorOptions).toContainEqual({
      label: "NVIDIA GPU - Tesla-V100",
      value: "nvidia_gpu:Tesla-V100",
      type: "nvidia_gpu",
      product: "Tesla-V100",
      available: 3,
      total: 4,
    });
  });

  it("should parse product groups when products is empty", () => {
    const resourceInfo: ClusterResourceInfo = {
      allocatable: {
        cpu: 100,
        memory: 256,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 4,
            product_groups: {
              "Tesla-T4": 4,
            },
            products: {},
          },
        },
      },
      available: {
        cpu: 80,
        memory: 200,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 2,
            product_groups: {
              "Tesla-T4": 2,
            },
            products: {},
          },
        },
      },
      node_resources: null,
    };

    const result = parseClusterResources(resourceInfo, mockTranslate);

    expect(result.acceleratorOptions).toEqual([
      {
        label: "NVIDIA GPU - Tesla-T4",
        value: "nvidia_gpu:Tesla-T4",
        type: "nvidia_gpu",
        product: "Tesla-T4",
        available: 2,
        total: 4,
      },
    ]);
  });

  it("omits unknown accelerator memory totals instead of setting undefined", () => {
    const resourceInfo: ClusterResourceInfo = {
      allocatable: {
        cpu: 100,
        memory: 256,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 4,
            product_groups: {
              "Tesla-T4": 4,
            },
          },
        },
      },
      available: {
        cpu: 80,
        memory: 200,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 2,
            product_groups: {
              "Tesla-T4": 2,
            },
          },
        },
      },
      node_resources: null,
    };

    const result = parseClusterResources(resourceInfo, mockTranslate);

    expect(result.acceleratorOptions[0]).not.toHaveProperty("memoryTotalMiB");
  });

  it("should derive accelerator memory total from node devices when metadata is absent", () => {
    const resourceInfo: ClusterResourceInfo = {
      allocatable: {
        cpu: 100,
        memory: 256,
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
        cpu: 80,
        memory: 200,
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
      node_resources: {
        "node-1": {
          allocatable: null,
          available: null,
          devices: [
            {
              uuid: "GPU-1",
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
    };

    const result = parseClusterResources(resourceInfo, mockTranslate);

    expect(result.acceleratorOptions[0].memoryTotalMiB).toBe(15360);
  });

  it("should handle accelerators without product groups", () => {
    const resourceInfo: ClusterResourceInfo = {
      allocatable: {
        cpu: 100,
        memory: 256,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 4,
            product_groups: null,
          },
        },
      },
      available: {
        cpu: 80,
        memory: 200,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 2,
            product_groups: null,
          },
        },
      },
      node_resources: null,
    };

    const result = parseClusterResources(resourceInfo, mockTranslate);
    expect(result.acceleratorOptions).toHaveLength(1);
    expect(result.acceleratorOptions[0]).toEqual({
      label: "NVIDIA GPU",
      value: "nvidia_gpu:generic",
      type: "nvidia_gpu",
      product: "",
      available: 2,
      total: 4,
    });
  });
});

/**
 * A node with `cpu`/`memory` allocatable, the given free share, and optionally
 * `gpus` cards of `product` ("" for a generic accelerator with no product).
 */
const gpuNode = ({
  cpu,
  memory,
  free = { cpu, memory },
  gpus,
  freeGpus = gpus,
  product = "Tesla-T4",
}: {
  cpu: number;
  memory: number;
  free?: { cpu: number; memory: number } | null;
  gpus?: number;
  freeGpus?: number;
  product?: string;
}): ResourceStatus => {
  const groups = (quantity: number | undefined) =>
    quantity === undefined
      ? null
      : {
          nvidia_gpu: {
            quantity,
            product_groups: product ? { [product]: quantity } : null,
          },
        };
  return {
    allocatable: { cpu, memory, accelerator_groups: groups(gpus) },
    available: free && { ...free, accelerator_groups: groups(freeGpus) },
  };
};

describe("findBestNodeForAccelerator", () => {
  it("should return null when nodeResources is null or undefined", () => {
    expect(
      findBestNodeForAccelerator(null, "nvidia_gpu", "Tesla-T4"),
    ).toBeNull();
    expect(
      findBestNodeForAccelerator(undefined, "nvidia_gpu", "Tesla-T4"),
    ).toBeNull();
  });

  it("should return null when no nodes have the specified accelerator", () => {
    const result = findBestNodeForAccelerator(
      { "node-1": gpuNode({ cpu: 10, memory: 20 }) },
      "nvidia_gpu",
      "Tesla-T4",
    );
    expect(result).toBeNull();
  });

  it("should find the node with the most GPUs", () => {
    const result = findBestNodeForAccelerator(
      {
        "node-1": gpuNode({
          cpu: 10,
          memory: 20,
          free: { cpu: 8, memory: 16 },
          gpus: 2,
          freeGpus: 1,
        }),
        "node-2": gpuNode({
          cpu: 20,
          memory: 40,
          free: { cpu: 16, memory: 32 },
          gpus: 4,
          freeGpus: 2,
        }),
      },
      "nvidia_gpu",
      "Tesla-T4",
    );
    expect(result).toEqual({
      nodeName: "node-2",
      cpu: { available: 16, total: 20 },
      memory: { available: 32, total: 40 },
      gpu: { available: 2, total: 4 },
    });
  });

  it("should use cpu + memory as tiebreaker when GPU counts are equal", () => {
    const result = findBestNodeForAccelerator(
      {
        "node-1": gpuNode({ cpu: 10, memory: 20, gpus: 2 }),
        "node-2": gpuNode({ cpu: 20, memory: 40, gpus: 2 }),
      },
      "nvidia_gpu",
      "Tesla-T4",
    );
    expect(result?.nodeName).toBe("node-2");
  });

  it("should only consider nodes with the specified product", () => {
    const result = findBestNodeForAccelerator(
      {
        "node-t4": gpuNode({ cpu: 10, memory: 20, gpus: 4 }),
        "node-v100": gpuNode({
          cpu: 20,
          memory: 40,
          gpus: 8,
          product: "Tesla-V100",
        }),
      },
      "nvidia_gpu",
      "Tesla-T4",
    );
    expect(result?.nodeName).toBe("node-t4");
    expect(result?.gpu.available).toBe(4);
  });

  it("should handle generic accelerator (no product)", () => {
    const result = findBestNodeForAccelerator(
      {
        "node-1": gpuNode({
          cpu: 10,
          memory: 20,
          free: { cpu: 8, memory: 16 },
          gpus: 4,
          freeGpus: 2,
          product: "",
        }),
      },
      "nvidia_gpu",
      "generic",
    );
    expect(result).toEqual({
      nodeName: "node-1",
      cpu: { available: 8, total: 10 },
      memory: { available: 16, total: 20 },
      gpu: { available: 2, total: 4 },
    });
  });

  it("should break a tie on free GPUs by free cpu + memory, ignoring CPU-only nodes", () => {
    const result = findBestNodeForAccelerator(
      {
        "controlplane-a": gpuNode({
          cpu: 3.7,
          memory: 5.4,
          free: { cpu: 2.52, memory: 4.79 },
        }),
        "gpu-t4-01": gpuNode({
          cpu: 7.7,
          memory: 13.27,
          free: { cpu: 3.08, memory: 7.89 },
          gpus: 1,
        }),
        "gpu-t4-02": gpuNode({
          cpu: 31.7,
          memory: 60.27,
          free: { cpu: 18.2, memory: 23.09 },
          gpus: 2,
          freeGpus: 1,
        }),
      },
      "nvidia_gpu",
      "Tesla-T4",
    );

    expect(result).toEqual({
      nodeName: "gpu-t4-02",
      gpu: { available: 1, total: 2 },
      cpu: { available: 18.2, total: 31.7 },
      memory: { available: 23.09, total: 60.27 },
    });
  });

  it("should find best node by cpu + memory when no accelerator specified, reporting no GPU", () => {
    const result = findBestNodeForAccelerator({
      "cpu-node": gpuNode({ cpu: 8, memory: 16, free: { cpu: 6, memory: 12 } }),
      "gpu-node": gpuNode({
        cpu: 32,
        memory: 64,
        free: { cpu: 24, memory: 48 },
        gpus: 4,
        freeGpus: 2,
      }),
    });
    expect(result).toEqual({
      nodeName: "gpu-node",
      cpu: { available: 24, total: 32 },
      memory: { available: 48, total: 64 },
      gpu: { available: 0, total: 0 },
    });
  });

  it("should skip nodes with no available resources", () => {
    const result = findBestNodeForAccelerator(
      {
        "node-1": gpuNode({ cpu: 10, memory: 20, free: null, gpus: 2 }),
        "node-2": gpuNode({ cpu: 10, memory: 20, gpus: 1 }),
      },
      "nvidia_gpu",
      "Tesla-T4",
    );
    expect(result?.nodeName).toBe("node-2");
  });

  it("should count only fully free devices as full-card available for virtualized products", () => {
    const nodeResources: Record<string, NodeResourceStatus> = {
      "node-1": {
        allocatable: {
          cpu: 32,
          memory: 64,
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
          memory: 48,
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
    };

    expect(
      findBestNodeForAccelerator(nodeResources, "nvidia_gpu", "Tesla-T4"),
    ).toEqual({
      nodeName: "node-1",
      cpu: { available: 24, total: 32 },
      memory: { available: 48, total: 64 },
      gpu: { available: 1, total: 2 },
    });
  });
});

it("preserves generic GPUs after cache-pool aggregation", () => {
  const nodes: Record<string, NodeResourceStatus> = {
    "cache-node": {
      allocatable: {
        cpu: 8,
        memory: 16,
        accelerator_groups: {
          nvidia_gpu: { quantity: 2, product_groups: null },
        },
      },
      available: {
        cpu: 4,
        memory: 8,
        accelerator_groups: {
          nvidia_gpu: { quantity: 1, product_groups: null },
        },
      },
    },
  };
  const result = parseClusterResources(
    {
      allocatable: cachePoolResources(nodes, "allocatable"),
      available: cachePoolResources(nodes, "available"),
      node_resources: nodes,
    },
    mockTranslate,
  );
  expect(result.acceleratorOptions).toEqual([
    {
      label: "NVIDIA GPU",
      value: "nvidia_gpu:generic",
      type: "nvidia_gpu",
      product: "",
      available: 1,
      total: 2,
    },
  ]);
});

it("sums vGPU product pools across cache-pool nodes", () => {
  const t4 = (quantity: number, memory_mib: number, core_units: number) => ({
    cpu: 8,
    memory: 32,
    accelerator_groups: {
      nvidia_gpu: {
        quantity,
        product_groups: null,
        products: {
          "Tesla-T4": { quantity, virtualization: { memory_mib, core_units } },
        },
      },
    },
  });
  const nodes: Record<string, NodeResourceStatus> = {
    "node-a": { allocatable: t4(2, 30720, 200), available: t4(1, 7680, 50) },
    "node-b": { allocatable: t4(1, 15360, 100), available: t4(1, 15360, 100) },
  };

  expect(
    cachePoolResources(nodes, "available").accelerator_groups?.nvidia_gpu,
  ).toEqual({
    quantity: 2,
    product_groups: {},
    products: {
      "Tesla-T4": {
        quantity: 2,
        virtualization: { memory_mib: 23040, core_units: 150 },
      },
    },
  });
});
