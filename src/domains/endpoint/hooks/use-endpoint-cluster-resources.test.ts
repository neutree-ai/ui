import type { EndpointClusterRef } from "@/domains/endpoint/types";
import type { ResourceStatus } from "@/foundation/types/resource-types";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEndpointClusterResources } from "./use-endpoint-cluster-resources";

const mockT = (key: string) => key;

const zeroUsage = { cpu: 0, memory: 0, gpu: 0 };

interface AcceleratorGroupDef {
  quantity: number;
  product_groups: Record<string, number> | null;
}

function makeCluster(
  name: string,
  type: string,
  overrides?: Partial<{
    allocatable: { cpu: number; memory: number };
    available: { cpu: number; memory: number };
    nodeResources: Record<string, ResourceStatus>;
    acceleratorGroups: Record<string, AcceleratorGroupDef> | null;
    availableAcceleratorGroups: Record<string, AcceleratorGroupDef> | null;
  }>,
): EndpointClusterRef {
  return {
    metadata: { name } as EndpointClusterRef["metadata"],
    spec: { type },
    status: {
      resource_info: {
        allocatable: {
          cpu: overrides?.allocatable?.cpu ?? 16,
          memory: overrides?.allocatable?.memory ?? 32,
          accelerator_groups: overrides?.acceleratorGroups ?? null,
        },
        available: {
          cpu: overrides?.available?.cpu ?? 10,
          memory: overrides?.available?.memory ?? 20,
          accelerator_groups: overrides?.availableAcceleratorGroups ?? null,
        },
        node_resources: overrides?.nodeResources ?? null,
      },
    },
  };
}

describe("useEndpointClusterResources", () => {
  it("returns zero maxAvailable when no cluster selected", () => {
    const { result } = renderHook(() =>
      useEndpointClusterResources({
        currentCluster: "",
        clustersData: [],
        selectedAccelerator: null,
        cpuUsage: 0,
        memoryUsage: 0,
        currentUsage: zeroUsage,
        t: mockT,
      }),
    );

    expect(result.current.selectedCluster).toBeUndefined();
    expect(result.current.clusterResources).toBeNull();
    expect(result.current.acceleratorOptions).toEqual([]);
    expect(result.current.maxAvailable.cpu).toEqual({
      available: 0,
      total: 0,
    });
  });

  it("returns zero maxAvailable when clustersData is undefined", () => {
    const { result } = renderHook(() =>
      useEndpointClusterResources({
        currentCluster: "my-cluster",
        clustersData: undefined,
        selectedAccelerator: null,
        cpuUsage: 0,
        memoryUsage: 0,
        currentUsage: zeroUsage,
        t: mockT,
      }),
    );

    expect(result.current.selectedCluster).toBeUndefined();
  });

  it("finds the selected cluster and parses its resources", () => {
    const clusters = [
      makeCluster("cluster-a", "k8s"),
      makeCluster("cluster-b", "ssh", {
        allocatable: { cpu: 100, memory: 256 },
        available: { cpu: 80, memory: 200 },
      }),
    ];

    const { result } = renderHook(() =>
      useEndpointClusterResources({
        currentCluster: "cluster-b",
        clustersData: clusters,
        selectedAccelerator: null,
        cpuUsage: 0,
        memoryUsage: 0,
        currentUsage: zeroUsage,
        t: mockT,
      }),
    );

    expect(result.current.selectedCluster?.metadata.name).toBe("cluster-b");
    expect(result.current.clusterResources).toEqual({
      cpu: { available: 80, total: 100 },
      memory: { available: 200, total: 256 },
    });
  });

  it("returns accelerator options from cluster resources", () => {
    const clusters = [
      makeCluster("gpu-cluster", "k8s", {
        acceleratorGroups: {
          nvidia_gpu: {
            quantity: 4,
            product_groups: { "Tesla-T4": 4 },
          },
        },
        availableAcceleratorGroups: {
          nvidia_gpu: {
            quantity: 2,
            product_groups: { "Tesla-T4": 2 },
          },
        },
      }),
    ];

    const { result } = renderHook(() =>
      useEndpointClusterResources({
        currentCluster: "gpu-cluster",
        clustersData: clusters,
        selectedAccelerator: null,
        cpuUsage: 0,
        memoryUsage: 0,
        currentUsage: zeroUsage,
        t: mockT,
      }),
    );

    expect(result.current.acceleratorOptions).toHaveLength(1);
    expect(result.current.acceleratorOptions[0]).toMatchObject({
      type: "nvidia_gpu",
      product: "Tesla-T4",
    });
  });

  it("computes maxAvailable from single-node max when accelerator selected", () => {
    const nodeResources = {
      "node-1": {
        allocatable: {
          cpu: 20,
          memory: 40,
          accelerator_groups: {
            nvidia_gpu: { quantity: 4, product_groups: { "Tesla-T4": 4 } },
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

    const clusters = [
      makeCluster("gpu-cluster", "k8s", {
        nodeResources,
        acceleratorGroups: {
          nvidia_gpu: { quantity: 4, product_groups: { "Tesla-T4": 4 } },
        },
        availableAcceleratorGroups: {
          nvidia_gpu: { quantity: 2, product_groups: { "Tesla-T4": 2 } },
        },
      }),
    ];

    const { result } = renderHook(() =>
      useEndpointClusterResources({
        currentCluster: "gpu-cluster",
        clustersData: clusters,
        selectedAccelerator: { type: "nvidia_gpu", product: "Tesla-T4" },
        cpuUsage: 0,
        memoryUsage: 0,
        currentUsage: zeroUsage,
        t: mockT,
      }),
    );

    // maxAvailable should come from single-node best (node-1)
    expect(result.current.maxAvailable.cpu).toEqual({
      available: 16,
      total: 20,
    });
    expect(result.current.maxAvailable.gpu).toEqual({
      available: 2,
      total: 4,
    });
  });

  it("falls back to cluster-level resources when no accelerator selected", () => {
    const clusters = [
      makeCluster("cpu-cluster", "k8s", {
        allocatable: { cpu: 100, memory: 256 },
        available: { cpu: 80, memory: 200 },
      }),
    ];

    const { result } = renderHook(() =>
      useEndpointClusterResources({
        currentCluster: "cpu-cluster",
        clustersData: clusters,
        selectedAccelerator: null,
        cpuUsage: 0,
        memoryUsage: 0,
        currentUsage: zeroUsage,
        t: mockT,
      }),
    );

    expect(result.current.maxAvailable.cpu).toEqual({
      available: 80,
      total: 100,
    });
    expect(result.current.maxAvailable.gpu).toEqual({
      available: 0,
      total: 0,
    });
  });

  it("computes dynamicAvailability by subtracting current form values", () => {
    const clusters = [
      makeCluster("cluster-a", "k8s", {
        allocatable: { cpu: 100, memory: 256 },
        available: { cpu: 80, memory: 200 },
      }),
    ];

    const { result } = renderHook(() =>
      useEndpointClusterResources({
        currentCluster: "cluster-a",
        clustersData: clusters,
        selectedAccelerator: null,
        cpuUsage: 10,
        memoryUsage: 50,
        currentUsage: zeroUsage,
        t: mockT,
      }),
    );

    expect(result.current.dynamicAvailability).toEqual({
      cpu: 70, // 80 - 10
      memory: 150, // 200 - 50
    });
  });

  it("returns gpuStep 0.1 for ssh cluster", () => {
    const clusters = [makeCluster("ssh-cluster", "ssh")];

    const { result } = renderHook(() =>
      useEndpointClusterResources({
        currentCluster: "ssh-cluster",
        clustersData: clusters,
        selectedAccelerator: null,
        cpuUsage: 0,
        memoryUsage: 0,
        currentUsage: zeroUsage,
        t: mockT,
      }),
    );

    expect(result.current.gpuStep).toBe(0.1);
  });

  it("returns gpuStep 1 for k8s cluster", () => {
    const clusters = [makeCluster("k8s-cluster", "k8s")];

    const { result } = renderHook(() =>
      useEndpointClusterResources({
        currentCluster: "k8s-cluster",
        clustersData: clusters,
        selectedAccelerator: null,
        cpuUsage: 0,
        memoryUsage: 0,
        currentUsage: zeroUsage,
        t: mockT,
      }),
    );

    expect(result.current.gpuStep).toBe(1);
  });

  it("adds currentUsage back to maxAvailable", () => {
    const clusters = [
      makeCluster("cluster-a", "k8s", {
        allocatable: { cpu: 100, memory: 256 },
        available: { cpu: 80, memory: 200 },
      }),
    ];

    const { result } = renderHook(() =>
      useEndpointClusterResources({
        currentCluster: "cluster-a",
        clustersData: clusters,
        selectedAccelerator: null,
        cpuUsage: 0,
        memoryUsage: 0,
        currentUsage: { cpu: 4, memory: 8, gpu: 0 },
        t: mockT,
      }),
    );

    // cluster available (80) + currentUsage (4) = 84
    expect(result.current.maxAvailable.cpu.available).toBe(84);
    expect(result.current.maxAvailable.memory.available).toBe(208);
  });
});
