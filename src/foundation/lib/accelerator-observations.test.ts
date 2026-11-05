import { describe, expect, it } from "vitest";
import {
  type AcceleratorSample,
  allocationColor,
  assignAllocationColors,
  endpointAllocationUsedMiB,
  type GpuAllocation,
  gpuAllocations,
  groupGpuAllocationsByEndpoint,
  nodeL1CacheByNode,
  nodeReading,
  reading,
  splitGpuEndpointAllocations,
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

it("groups ownership per Endpoint and keeps the first eight sorted allocations", () => {
  const allocations = Array.from({ length: 10 }, (_, index) => ({
    ...allocation,
    endpoint: `endpoint-${index + 1}`,
    replica: `pod-${index + 1}`,
    instance: `pod-${index + 1}`,
    memoryMiB: index + 1,
    modelWeightsMiB: index + 1,
    kvCacheCapacityMiB: index + 1,
  }));
  const grouped = groupGpuAllocationsByEndpoint([
    ...allocations,
    {
      ...allocations[9],
      replica: "pod-10-second",
      instance: "pod-10-second",
      memoryMiB: 2,
    },
  ]);

  expect(grouped[0]).toMatchObject({
    endpoint: "endpoint-10",
    memoryMiB: 12,
  });

  const { visible, hidden, hiddenMemoryMiB } = splitGpuEndpointAllocations(
    grouped.flatMap((item) => item.allocations),
  );
  expect(visible).toHaveLength(8);
  expect(hidden.map((item) => item.endpoint)).toEqual([
    "endpoint-2",
    "endpoint-1",
  ]);
  expect(hiddenMemoryMiB).toBe(3);
});

it("keeps an Endpoint allocation colour stable across GPUs", () => {
  const firstOrder = allocationColor("endpoint-a");
  const reordered = allocationColor("endpoint-a");
  expect(reordered).toBe(firstOrder);
  expect(allocationColor("endpoint-b")).toMatch(/^var\(--nt-chart-series-/);
});

it("gives the Endpoints on one GPU distinguishable colours", () => {
  // These four all hash to series-1 with the raw palette index.
  const names = [
    "matrix-single-full",
    "matrix-shared-alpha",
    "matrix-shared-beta",
    "matrix-multi-alpha",
    "matrix-multi-beta",
    "matrix-multi-delta",
    "matrix-multi-gamma",
  ];

  const colors = assignAllocationColors(names);

  expect(new Set(names.map((name) => colors[name])).size).toBe(names.length);
});

it("resolves the same colours whatever order the allocations arrive in", () => {
  const names = ["gamma", "alpha", "beta", "delta"];

  expect(assignAllocationColors([...names].reverse())).toEqual(
    assignAllocationColors(names),
  );
});

it("keeps the hashed colour for an Endpoint that does not collide", () => {
  expect(assignAllocationColors(["solo"]).solo).toBe(allocationColor("solo"));
});

it("reuses palette entries instead of unpainting past the palette size", () => {
  const names = Array.from({ length: 11 }, (_, index) => `endpoint-${index}`);

  const colors = assignAllocationColors(names);

  for (const name of names) {
    expect(colors[name]).toMatch(/^var\(--nt-chart-series-\d\)$/);
  }
});

it("sums each replica's actual usage for one Endpoint on a shared GPU", () => {
  const grouped = groupGpuAllocationsByEndpoint([
    { ...allocation, replica: "pod-a", instance: "pod-a" },
    { ...allocation, replica: "pod-b", instance: "pod-b" },
  ])[0];
  const samples = [
    sample(2 * 1024 ** 3, { replica: "pod-a", instance_id: "pod-a" }),
    sample(3 * 1024 ** 3, { replica: "pod-b", instance_id: "pod-b" }),
  ];

  expect(endpointAllocationUsedMiB(samples, grouped, 2, null)).toBe(5 * 1024);
  expect(endpointAllocationUsedMiB(samples.slice(0, 1), grouped, 2, null)).toBe(
    null,
  );
});
