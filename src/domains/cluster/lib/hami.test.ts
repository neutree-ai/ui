import { describe, expect, it } from "vitest";
import type { Cluster } from "@/domains/cluster/types";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";
import {
  getHamiComponentStatus,
  getVgpuProductRows,
  isAcceleratorVirtualizationEnabled,
} from "./hami";

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

describe("cluster hami helpers", () => {
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

  it("returns HAMi component status from cluster status", () => {
    const cluster = makeCluster({
      status: {
        phase: "Running",
        reason: "",
        message: "",
        image: null,
        dashboard_url: null,
        component_status: {
          hami: {
            phase: "NotReady",
            reason: "DevicePluginConflict",
            message: "official device plugin is still enabled",
          },
        },
      } as Partial<Cluster>["status"],
    });

    expect(getHamiComponentStatus(cluster)).toEqual({
      phase: "NotReady",
      reason: "DevicePluginConflict",
      message: "official device plugin is still enabled",
    });
  });

  it("builds vGPU product rows from products and accelerator metadata", () => {
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

    expect(getVgpuProductRows(resourceInfo)).toEqual([
      {
        acceleratorType: "nvidia_gpu",
        product: "Tesla-T4",
        quantity: 3,
        availableQuantity: 3,
        memoryTotalMiB: 15360,
        allocatableVirtualizationMemoryMiB: 46080,
        availableVirtualizationMemoryMiB: 33792,
        allocatableCoreUnits: 300,
        availableCoreUnits: 240,
      },
    ]);
  });
});
