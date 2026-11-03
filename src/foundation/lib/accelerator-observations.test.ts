import { describe, expect, it } from "vitest";
import {
  type AcceleratorSample,
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
  age = 0,
): AcceleratorSample => ({
  metric,
  value,
  observed_at: Date.now() / 1000 - age,
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
describe("accelerator readings", () => {
  it("does not conflate nodes, replicas, endpoints or vGPU slices", () => {
    for (const labels of [
      { node: "other" },
      { replica: "other" },
      { endpoint: "other" },
    ] as Record<string, string>[])
      expect(
        reading([sample(40, labels)], metric, "node", "gpu", allocation),
      ).toBeUndefined();
    expect(
      reading(
        [sample(40), sample(60, { vdevice_index: "1" })],
        metric,
        "node",
        "gpu",
        allocation,
      ),
    ).toBeUndefined();
    expect(
      reading(
        [sample(40), sample(60, { vdevice_index: "1" })],
        metric,
        "node",
        "gpu",
        { ...allocation, vdevice: "1" },
      )?.value,
    ).toBe(60);
  });
  it("uses the newest duplicate scrape without summing", () => {
    expect(
      reading(
        [sample(40, {}, 20), sample(50)],
        metric,
        "node",
        "gpu",
        allocation,
      )?.value,
    ).toBe(50);
  });
  it("does not use whole-card memory for a replica", () => {
    expect(
      reading(
        [{ ...sample(40), metric: "neutree_accelerator_memory_used_bytes" }],
        metric,
        "node",
        "gpu",
        allocation,
      ),
    ).toBeUndefined();
  });
  it("excludes retained allocations on paused endpoints", () => {
    expect(
      gpuAllocations([
        {
          metadata: { name: "a", workspace: "w" },
          spec: { model: null },
          status: {
            phase: "Paused",
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
  });
});

it("maps cache capacity and selects the newest L1 reading, including zero", () => {
  expect(
    nodeL1CacheByNode([{ name: "gpu-a", capacity_bytes: 8 * 1024 ** 3 }], []),
  ).toEqual({
    "gpu-a": { usedGiB: null, capacityGiB: 8 },
  });
  const metric = "neutree_cache_l1_memory_used_bytes";
  expect(
    nodeReading(
      [
        { metric, labels: { node: "gpu-a" }, value: 0, observed_at: 1040 },
        {
          metric,
          labels: { node: "gpu-a" },
          value: 6 * 1024 ** 3,
          observed_at: 1000,
        },
      ],
      metric,
      "gpu-a",
    )?.value,
  ).toBe(0);
});
