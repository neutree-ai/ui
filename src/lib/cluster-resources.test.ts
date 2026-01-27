import type { Cluster, ResourceStatus } from "@/types";
import { describe, expect, it } from "vitest";
import {
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
  it("should return null summary when cluster is undefined", () => {
    const result = parseClusterResources(undefined, mockTranslate);
    expect(result.summary).toBeNull();
    expect(result.acceleratorOptions).toEqual([]);
  });

  it("should return null summary when resource_info is missing", () => {
    const cluster = { status: {} } as unknown as Cluster;
    const result = parseClusterResources(cluster, mockTranslate);
    expect(result.summary).toBeNull();
  });

  it("should parse basic CPU and memory resources", () => {
    const cluster = {
      status: {
        resource_info: {
          allocatable: { cpu: 100, memory: 256 },
          available: { cpu: 80, memory: 200 },
        },
      },
    } as unknown as Cluster;

    const result = parseClusterResources(cluster, mockTranslate);
    expect(result.summary).toEqual({
      cpu: { available: 80, total: 100 },
      memory: { available: 200, total: 256 },
    });
  });

  it("should parse accelerator options with product groups", () => {
    const cluster = {
      status: {
        resource_info: {
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
        },
      },
    } as unknown as Cluster;

    const result = parseClusterResources(cluster, mockTranslate);
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

  it("should handle accelerators without product groups", () => {
    const cluster = {
      status: {
        resource_info: {
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
        },
      },
    } as unknown as Cluster;

    const result = parseClusterResources(cluster, mockTranslate);
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
    const nodeResources: Record<string, ResourceStatus> = {
      "node-1": {
        allocatable: { cpu: 10, memory: 20, accelerator_groups: null },
        available: { cpu: 8, memory: 16, accelerator_groups: null },
      },
    };

    const result = findBestNodeForAccelerator(
      nodeResources,
      "nvidia_gpu",
      "Tesla-T4",
    );
    expect(result).toBeNull();
  });

  it("should find the node with the most GPUs", () => {
    const nodeResources: Record<string, ResourceStatus> = {
      "node-1": {
        allocatable: {
          cpu: 10,
          memory: 20,
          accelerator_groups: {
            nvidia_gpu: {
              quantity: 2,
              product_groups: { "Tesla-T4": 2 },
            },
          },
        },
        available: {
          cpu: 8,
          memory: 16,
          accelerator_groups: {
            nvidia_gpu: {
              quantity: 1,
              product_groups: { "Tesla-T4": 1 },
            },
          },
        },
      },
      "node-2": {
        allocatable: {
          cpu: 20,
          memory: 40,
          accelerator_groups: {
            nvidia_gpu: {
              quantity: 4,
              product_groups: { "Tesla-T4": 4 },
            },
          },
        },
        available: {
          cpu: 16,
          memory: 32,
          accelerator_groups: {
            nvidia_gpu: {
              quantity: 2,
              product_groups: { "Tesla-T4": 2 },
            },
          },
        },
      },
    };

    const result = findBestNodeForAccelerator(
      nodeResources,
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
    const nodeResources: Record<string, ResourceStatus> = {
      "node-1": {
        allocatable: {
          cpu: 10,
          memory: 20,
          accelerator_groups: {
            nvidia_gpu: { quantity: 2, product_groups: { "Tesla-T4": 2 } },
          },
        },
        available: {
          cpu: 8,
          memory: 16,
          accelerator_groups: {
            nvidia_gpu: { quantity: 2, product_groups: { "Tesla-T4": 2 } },
          },
        },
      },
      "node-2": {
        allocatable: {
          cpu: 20,
          memory: 40,
          accelerator_groups: {
            nvidia_gpu: { quantity: 2, product_groups: { "Tesla-T4": 2 } },
          },
        },
        available: {
          cpu: 16,
          memory: 32,
          accelerator_groups: {
            nvidia_gpu: { quantity: 2, product_groups: { "Tesla-T4": 2 } },
          },
        },
      },
    };

    const result = findBestNodeForAccelerator(
      nodeResources,
      "nvidia_gpu",
      "Tesla-T4",
    );
    // node-2 has higher cpu + memory (16 + 32 = 48 vs 8 + 16 = 24)
    expect(result?.nodeName).toBe("node-2");
  });

  it("should only consider nodes with the specified product", () => {
    const nodeResources: Record<string, ResourceStatus> = {
      "node-t4": {
        allocatable: {
          cpu: 10,
          memory: 20,
          accelerator_groups: {
            nvidia_gpu: { quantity: 4, product_groups: { "Tesla-T4": 4 } },
          },
        },
        available: {
          cpu: 8,
          memory: 16,
          accelerator_groups: {
            nvidia_gpu: { quantity: 4, product_groups: { "Tesla-T4": 4 } },
          },
        },
      },
      "node-v100": {
        allocatable: {
          cpu: 20,
          memory: 40,
          accelerator_groups: {
            nvidia_gpu: { quantity: 8, product_groups: { "Tesla-V100": 8 } },
          },
        },
        available: {
          cpu: 16,
          memory: 32,
          accelerator_groups: {
            nvidia_gpu: { quantity: 8, product_groups: { "Tesla-V100": 8 } },
          },
        },
      },
    };

    // Should only find node-t4 when looking for Tesla-T4
    const result = findBestNodeForAccelerator(
      nodeResources,
      "nvidia_gpu",
      "Tesla-T4",
    );
    expect(result?.nodeName).toBe("node-t4");
    expect(result?.gpu.available).toBe(4);
  });

  it("should handle generic accelerator (no product)", () => {
    const nodeResources: Record<string, ResourceStatus> = {
      "node-1": {
        allocatable: {
          cpu: 10,
          memory: 20,
          accelerator_groups: {
            nvidia_gpu: { quantity: 4, product_groups: null },
          },
        },
        available: {
          cpu: 8,
          memory: 16,
          accelerator_groups: {
            nvidia_gpu: { quantity: 2, product_groups: null },
          },
        },
      },
    };

    const result = findBestNodeForAccelerator(
      nodeResources,
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

  it("should handle real-world scenario with mixed nodes", () => {
    // Based on the user's actual data structure
    const nodeResources: Record<string, ResourceStatus> = {
      "neutree-ci-test-controlplane-cqg4v": {
        allocatable: { cpu: 3.7, memory: 5.4, accelerator_groups: null },
        available: { cpu: 2.52, memory: 4.79, accelerator_groups: null },
      },
      "neutree-ci-test-controlplane-kj5zr": {
        allocatable: { cpu: 3.7, memory: 5.4, accelerator_groups: null },
        available: { cpu: 2.73, memory: 4.82, accelerator_groups: null },
      },
      "neutree-gpu-t4-01": {
        allocatable: {
          cpu: 7.7,
          memory: 13.27,
          accelerator_groups: {
            nvidia_gpu: { quantity: 1, product_groups: { "Tesla-T4": 1 } },
          },
        },
        available: {
          cpu: 3.08,
          memory: 7.89,
          accelerator_groups: {
            nvidia_gpu: { quantity: 1, product_groups: { "Tesla-T4": 1 } },
          },
        },
      },
      "neutree-gpu-t4-02": {
        allocatable: {
          cpu: 31.7,
          memory: 60.27,
          accelerator_groups: {
            nvidia_gpu: { quantity: 2, product_groups: { "Tesla-T4": 2 } },
          },
        },
        available: {
          cpu: 18.2,
          memory: 23.09,
          accelerator_groups: {
            nvidia_gpu: { quantity: 1, product_groups: { "Tesla-T4": 1 } },
          },
        },
      },
    };

    const result = findBestNodeForAccelerator(
      nodeResources,
      "nvidia_gpu",
      "Tesla-T4",
    );

    // Both GPU nodes have 1 GPU available, so tiebreaker is cpu + memory
    // node-t4-01: 3.08 + 7.89 = 10.97
    // node-t4-02: 18.2 + 23.09 = 41.29
    // node-t4-02 should win
    expect(result?.nodeName).toBe("neutree-gpu-t4-02");
    expect(result?.gpu).toEqual({ available: 1, total: 2 });
    expect(result?.cpu).toEqual({ available: 18.2, total: 31.7 });
    expect(result?.memory).toEqual({ available: 23.09, total: 60.27 });
  });

  it("should find best node by cpu + memory when no accelerator specified (CPU-only)", () => {
    const nodeResources: Record<string, ResourceStatus> = {
      "node-1": {
        allocatable: { cpu: 10, memory: 20, accelerator_groups: null },
        available: { cpu: 8, memory: 16, accelerator_groups: null },
      },
      "node-2": {
        allocatable: { cpu: 20, memory: 40, accelerator_groups: null },
        available: { cpu: 16, memory: 32, accelerator_groups: null },
      },
    };

    const result = findBestNodeForAccelerator(nodeResources);
    expect(result).toEqual({
      nodeName: "node-2",
      cpu: { available: 16, total: 20 },
      memory: { available: 32, total: 40 },
      gpu: { available: 0, total: 0 },
    });
  });

  it("should consider all nodes including GPU nodes when no accelerator specified", () => {
    const nodeResources: Record<string, ResourceStatus> = {
      "cpu-node": {
        allocatable: { cpu: 8, memory: 16, accelerator_groups: null },
        available: { cpu: 6, memory: 12, accelerator_groups: null },
      },
      "gpu-node": {
        allocatable: {
          cpu: 32,
          memory: 64,
          accelerator_groups: {
            nvidia_gpu: { quantity: 4, product_groups: { "Tesla-T4": 4 } },
          },
        },
        available: {
          cpu: 24,
          memory: 48,
          accelerator_groups: {
            nvidia_gpu: { quantity: 2, product_groups: { "Tesla-T4": 2 } },
          },
        },
      },
    };

    // CPU-only mode: gpu-node has more cpu+memory, so it should be selected
    // but gpu should be reported as 0
    const result = findBestNodeForAccelerator(nodeResources);
    expect(result).toEqual({
      nodeName: "gpu-node",
      cpu: { available: 24, total: 32 },
      memory: { available: 48, total: 64 },
      gpu: { available: 0, total: 0 },
    });
  });

  it("should skip nodes with no available resources", () => {
    const nodeResources: Record<string, ResourceStatus> = {
      "node-1": {
        allocatable: {
          cpu: 10,
          memory: 20,
          accelerator_groups: {
            nvidia_gpu: { quantity: 2, product_groups: { "Tesla-T4": 2 } },
          },
        },
        available: null,
      },
      "node-2": {
        allocatable: {
          cpu: 10,
          memory: 20,
          accelerator_groups: {
            nvidia_gpu: { quantity: 1, product_groups: { "Tesla-T4": 1 } },
          },
        },
        available: {
          cpu: 8,
          memory: 16,
          accelerator_groups: {
            nvidia_gpu: { quantity: 1, product_groups: { "Tesla-T4": 1 } },
          },
        },
      },
    };

    const result = findBestNodeForAccelerator(
      nodeResources,
      "nvidia_gpu",
      "Tesla-T4",
    );
    expect(result?.nodeName).toBe("node-2");
  });
});
