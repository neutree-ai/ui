import { describe, expect, it } from "vitest";
import type { Cluster } from "@/domains/cluster/types";
import {
  makeGpuDevice,
  makeNodeResources,
} from "@/foundation/testing/resource-builders";
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

const t4Pool = (
  quantity: number,
  virtualization?: { memory_mib: number; core_units: number },
  productGroups: Record<string, number> | null = null,
) => ({
  cpu: 16,
  memory: 64,
  accelerator_groups: {
    nvidia_gpu: {
      quantity,
      product_groups: productGroups,
      products: virtualization
        ? { "Tesla-T4": { quantity, virtualization } }
        : {},
    },
  },
});

const t4Row = (overrides: Record<string, number>) => ({
  acceleratorType: "nvidia_gpu",
  product: "Tesla-T4",
  quantity: 3,
  availableQuantity: 3,
  ...overrides,
});

describe("cluster accelerator virtualization helpers", () => {
  it.each([
    [undefined, false],
    [{ enabled: true }, true],
  ])("reads accelerator virtualization %j as enabled: %s", (av, enabled) => {
    const cluster = makeCluster();
    cluster.spec.accelerator_virtualization = av;
    expect(isAcceleratorVirtualizationEnabled(cluster)).toBe(enabled);
  });

  it.each([
    ["v1.0.1", false],
    ["v1.0.2", true],
    ["v1.1.0", true],
    ["v1.2.0", true],
    [null, false],
  ])("supports accelerator virtualization on %s: %s", (version, supported) => {
    expect(isAcceleratorVirtualizationSupported(version)).toBe(supported);
  });

  it("builds accelerator product resource rows from virtualized product pools", () => {
    const resourceInfo = {
      accelerator_metadata: {
        nvidia_gpu: { products: { "Tesla-T4": { memory_total_mib: 15360 } } },
      },
      allocatable: t4Pool(
        3,
        { memory_mib: 46080, core_units: 300 },
        { "Tesla-T4": 3 },
      ),
      available: t4Pool(
        3,
        { memory_mib: 33792, core_units: 240 },
        { "Tesla-T4": 3 },
      ),
      node_resources: null,
    } as ClusterResourceInfo;

    expect(getAcceleratorProductResourceRows(resourceInfo)).toEqual([
      t4Row({
        memoryTotalMiB: 15360,
        allocatableMemoryMiB: 46080,
        availableMemoryMiB: 33792,
        allocatableCoreUnits: 300,
        availableCoreUnits: 240,
      }),
    ]);
  });

  it("rounds fallback per-card memory up to whole MiB", () => {
    const pool = t4Pool(3, { memory_mib: 100, core_units: 300 });
    const resourceInfo = {
      accelerator_metadata: null,
      allocatable: pool,
      available: pool,
      node_resources: null,
    } as ClusterResourceInfo;

    expect(getAcceleratorProductResourceRows(resourceInfo)).toEqual([
      t4Row({
        memoryTotalMiB: 34,
        allocatableMemoryMiB: 100,
        availableMemoryMiB: 100,
        allocatableCoreUnits: 300,
        availableCoreUnits: 300,
      }),
    ]);
  });

  it("falls back to product groups and device pools for non-virtualized resources", () => {
    const resourceInfo = {
      accelerator_metadata: null,
      allocatable: t4Pool(3, undefined, { "Tesla-T4": 3 }),
      available: t4Pool(2, undefined, { "Tesla-T4": 2 }),
      node_resources: {
        "node-a": makeNodeResources({
          devices: [
            makeGpuDevice("GPU-1"),
            makeGpuDevice("GPU-2", { memory_mib: 0, core_units: 0 }),
          ],
        }),
      },
    } as ClusterResourceInfo;

    expect(getAcceleratorProductResourceRows(resourceInfo)).toEqual([
      t4Row({
        availableQuantity: 2,
        memoryTotalMiB: 15360,
        allocatableMemoryMiB: 30720,
        availableMemoryMiB: 15360,
        allocatableCoreUnits: 200,
        availableCoreUnits: 100,
      }),
    ]);
  });
});
