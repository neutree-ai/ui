import { describe, expect, it } from "vitest";
import {
  type AcceleratorSample,
  allocationUsedMiB,
  deviceHardwareInfo,
  type GpuAllocation,
  gpuAllocations,
  nodeL1CacheByNode,
  nodeReading,
  reading,
} from "./accelerator-observations";

const metric = "neutree_endpoint_replica_accelerator_memory_used_bytes";
const allocation: GpuAllocation = {
  endpoint: "a",
  workspace: "w",
  model: "m",
  node: "node",
  uuid: "gpu",
  instance: "pod-a",
  replica: "pod-a",
  memoryMiB: 100,
};
const sample = (
  value = 0,
  labels: Record<string, string> = {},
  observed_at = 1000,
  name = metric,
): AcceleratorSample => ({
  metric: name,
  value,
  observed_at,
  labels: {
    node: "node",
    accelerator_uuid: "gpu",
    endpoint: "a",
    instance_id: "pod-a",
    replica: "pod-a",
    vdevice_index: "0",
    ...labels,
  },
});
const replicaReading = (
  samples: AcceleratorSample[],
  over: Partial<GpuAllocation> = {},
) => reading(samples, metric, "node", "gpu", { ...allocation, ...over });

describe("reading", () => {
  it.each<{ label: string; labels: Record<string, string> }>([
    { label: "node", labels: { node: "other" } },
    { label: "replica", labels: { replica: "other" } },
    { label: "endpoint", labels: { endpoint: "other" } },
  ])("ignores a sample of another $label", ({ labels }) => {
    expect(replicaReading([sample(40, labels)])).toBeUndefined();
  });

  it("has no reading for a replica spread over several vGPU slices unless one is named", () => {
    const slices = [sample(40), sample(60, { vdevice_index: "1" })];
    expect(replicaReading(slices)).toBeUndefined();
    expect(replicaReading(slices, { vdevice: "1" })?.value).toBe(60);
  });

  it("uses the newest duplicate scrape without summing", () => {
    expect(replicaReading([sample(40, {}, 980), sample(50)])?.value).toBe(50);
  });

  it("does not use whole-card memory for a replica", () => {
    expect(
      replicaReading([
        sample(40, {}, 1000, "neutree_accelerator_memory_used_bytes"),
      ]),
    ).toBeUndefined();
  });
});

describe("allocationUsedMiB", () => {
  it.each([
    { name: "a measured replica", measured: true, onCard: 2, used: 7168 },
    { name: "the only allocation", measured: false, onCard: 1, used: 13312 },
    { name: "a shared card", measured: false, onCard: 2, used: null },
  ])("$name -> $used MiB", ({ measured, onCard, used }) => {
    const samples = measured ? [sample(7 * 1024 ** 3)] : [];
    expect(allocationUsedMiB(samples, allocation, onCard, 13312)).toBe(used);
  });
});

describe("deviceHardwareInfo", () => {
  it("lets an extension info metric override the generic one, for this card only", () => {
    const info = (name: string, labels: Record<string, string>) =>
      sample(1, labels, 1000, `neutree_node_accelerator_${name}_info`);
    expect(
      deviceHardwareInfo(
        [
          info("example", { driver_version: "extension" }),
          info("hardware", { driver_version: "generic", pcie_width: "16" }),
          info("example", { node: "other", driver_version: "wrong-node" }),
        ],
        "node",
        "gpu",
      ),
    ).toMatchObject({ driver_version: "extension", pcie_width: "16" });
  });
});

describe("gpuAllocations", () => {
  it("builds the replica identity with its fallbacks", () => {
    expect(
      gpuAllocations([
        {
          metadata: { name: "a", workspace: null },
          spec: { model: { name: "m" } },
          status: {
            phase: "Running",
            resources: {
              replicas: [
                {
                  instance_id: "pod",
                  node_id: "replica-node",
                  model_weights_mib: 2048,
                  devices: [
                    {
                      uuid: "gpu",
                      node_id: "",
                      vdevice_index: "1",
                      product: "T4",
                      memory_mib: 100,
                      core_units: 100,
                    },
                  ],
                },
              ],
            },
          },
        },
      ]),
    ).toEqual([
      {
        endpoint: "a",
        workspace: "default",
        model: "m",
        node: "replica-node",
        uuid: "gpu",
        replica: "",
        instance: "pod",
        vdevice: "1",
        memoryMiB: 100,
        modelWeightsMiB: 2048,
        kvCacheCapacityMiB: null,
      },
    ]);
  });

  it.each(["Paused", "Deleted"])(
    "excludes allocations retained by a %s endpoint",
    (phase) => {
      expect(
        gpuAllocations([
          {
            metadata: { name: "a", workspace: "w" },
            spec: { model: null },
            status: {
              phase,
              resources: {
                replicas: [
                  {
                    instance_id: "pod",
                    devices: [
                      {
                        uuid: "gpu",
                        node_id: "node",
                        product: "T4",
                        memory_mib: 100,
                        core_units: 100,
                      },
                    ],
                  },
                ],
              },
            },
          },
        ]),
      ).toEqual([]);
    },
  );
});

describe("node L1 cache", () => {
  const l1 = "neutree_cache_l1_memory_used_bytes";

  it("selects the newest reading, including zero", () => {
    expect(
      nodeReading(
        [
          {
            metric: l1,
            labels: { node: "gpu-a" },
            value: 0,
            observed_at: 1040,
          },
          {
            metric: l1,
            labels: { node: "gpu-a" },
            value: 6 * 1024 ** 3,
            observed_at: 1000,
          },
        ],
        l1,
        "gpu-a",
      )?.value,
    ).toBe(0);
  });

  it("maps capacity per node, skipping nodes without capacity", () => {
    expect(
      nodeL1CacheByNode(
        [
          { name: "gpu-a", capacity_bytes: 8 * 1024 ** 3 },
          { name: "gpu-b", capacity_bytes: 0 },
        ],
        [],
      ),
    ).toEqual({ "gpu-a": { usedGiB: null, capacityGiB: 8 } });
  });
});
