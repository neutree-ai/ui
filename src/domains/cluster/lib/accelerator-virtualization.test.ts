import { describe, expect, it } from "vitest";
import type { Cluster } from "@/domains/cluster/types";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";
import {
  getAcceleratorProductResourceRows,
  isAcceleratorVirtualizationEnabled,
  isAcceleratorVirtualizationSupported,
} from "./accelerator-virtualization";

const makeCluster = (overrides: Partial<Cluster> = {}): Cluster =>
  ({
    api_version: "v1",
    kind: "Cluster",
    metadata: { name: "c1", workspace: "default" },
    spec: {
      type: "kubernetes",
      image_registry: "registry",
      config: { kubernetes_config: {} },
    },
    status: null,
    ...overrides,
  }) as Cluster;

describe("cluster accelerator virtualization helpers", () => {
  it("treats missing accelerator virtualization as disabled", () => {
    expect(isAcceleratorVirtualizationEnabled(makeCluster())).toBe(false);
  });

  it("reads accelerator virtualization enabled from cluster spec", () => {
    expect(
      isAcceleratorVirtualizationEnabled(
        makeCluster({
          spec: {
            type: "kubernetes",
            image_registry: "registry",
            config: { kubernetes_config: {} },
            accelerator_virtualization: { enabled: true },
          },
        } as Partial<Cluster>),
      ),
    ).toBe(true);
  });

  it("checks accelerator virtualization support by cluster version", () => {
    expect(isAcceleratorVirtualizationSupported("v1.0.1")).toBe(false);
    expect(isAcceleratorVirtualizationSupported("v1.0.2")).toBe(true);
    expect(isAcceleratorVirtualizationSupported("v1.1.0")).toBe(true);
    expect(isAcceleratorVirtualizationSupported("v1.2.0")).toBe(true);
    expect(isAcceleratorVirtualizationSupported(null)).toBe(false);
  });

  it("builds accelerator product resource rows from virtualized product pools", () => {
    const resourceInfo = {
      accelerator_metadata: {
        nvidia_gpu: {
          products: {
            "Tesla-T4": { memory_total_mib: 15360 },
          },
        },
      },
      allocatable: {
        cpu: 16,
        memory: 64,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 3,
            product_groups: { "Tesla-T4": 3 },
            products: {
              "Tesla-T4": {
                quantity: 3,
                virtualization: {
                  memory_mib: 46080,
                  core_units: 300,
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
            quantity: 3,
            product_groups: { "Tesla-T4": 3 },
            products: {
              "Tesla-T4": {
                quantity: 3,
                virtualization: {
                  memory_mib: 33792,
                  core_units: 240,
                },
              },
            },
          },
        },
      },
      node_resources: null,
    } as ClusterResourceInfo;

    expect(getAcceleratorProductResourceRows(resourceInfo)).toEqual([
      {
        acceleratorType: "nvidia_gpu",
        product: "Tesla-T4",
        quantity: 3,
        availableQuantity: 3,
        memoryTotalMiB: 15360,
        allocatableMemoryMiB: 46080,
        availableMemoryMiB: 33792,
        allocatableCoreUnits: 300,
        availableCoreUnits: 240,
      },
    ]);
  });

  it("rounds fallback per-card memory up to whole MiB", () => {
    const resourceInfo = {
      accelerator_metadata: null,
      allocatable: {
        cpu: 16,
        memory: 64,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 3,
            product_groups: null,
            products: {
              "Tesla-T4": {
                quantity: 3,
                virtualization: {
                  memory_mib: 100,
                  core_units: 300,
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
            quantity: 3,
            product_groups: null,
            products: {
              "Tesla-T4": {
                quantity: 3,
                virtualization: {
                  memory_mib: 100,
                  core_units: 300,
                },
              },
            },
          },
        },
      },
      node_resources: null,
    } as ClusterResourceInfo;

    expect(getAcceleratorProductResourceRows(resourceInfo)).toEqual([
      {
        acceleratorType: "nvidia_gpu",
        product: "Tesla-T4",
        quantity: 3,
        availableQuantity: 3,
        memoryTotalMiB: 34,
        allocatableMemoryMiB: 100,
        availableMemoryMiB: 100,
        allocatableCoreUnits: 300,
        availableCoreUnits: 300,
      },
    ]);
  });

  it("falls back to product groups and device pools for non-virtualized resources", () => {
    const resourceInfo = {
      accelerator_metadata: null,
      allocatable: {
        cpu: 16,
        memory: 64,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 3,
            product_groups: { "Tesla-T4": 3 },
            products: {},
          },
        },
      },
      available: {
        cpu: 12,
        memory: 48,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 2,
            product_groups: { "Tesla-T4": 2 },
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
              uuid: "GPU-1",
              product: "Tesla-T4",
              health: true,
              allocatable: { memory_mib: 15360, core_units: 100 },
              available: { memory_mib: 15360, core_units: 100 },
            },
            {
              uuid: "GPU-2",
              product: "Tesla-T4",
              health: true,
              allocatable: { memory_mib: 15360, core_units: 100 },
              available: { memory_mib: 0, core_units: 0 },
            },
          ],
        },
      },
    } as ClusterResourceInfo;

    expect(getAcceleratorProductResourceRows(resourceInfo)).toEqual([
      {
        acceleratorType: "nvidia_gpu",
        product: "Tesla-T4",
        quantity: 3,
        availableQuantity: 2,
        memoryTotalMiB: 15360,
        allocatableMemoryMiB: 30720,
        availableMemoryMiB: 15360,
        allocatableCoreUnits: 200,
        availableCoreUnits: 100,
      },
    ]);
  });
});
