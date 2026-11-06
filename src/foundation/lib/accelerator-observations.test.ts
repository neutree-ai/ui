import { describe, expect, it } from "vitest";
import { makeAcceleratorSample } from "@/foundation/testing/resource-builders";
import {
  allocationColor,
  allocationComposition,
  endpointAllocationUsedMiB,
  type GpuAllocation,
  gpuAllocations,
  groupGpuAllocationsByEndpoint,
  hardwareValue,
  nodeL1CacheByNode,
  nodeReading,
  reading,
  replicaSummary,
  replicaUsage,
  sampleAge,
  splitGpuEndpointAllocations,
} from "./accelerator-observations";
import { CHART_MORE_COLOR, chartCategoryMark } from "./chart-palette";

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
const sample = (value = 0, labels: Record<string, string> = {}, age = 0) =>
  makeAcceleratorSample(
    metric,
    value,
    {
      endpoint: "a",
      instance_id: "pod-a",
      replica: "pod-a",
      vdevice_index: "0",
      ...labels,
    },
    Date.now() / 1000 - age,
  );
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
        makeAcceleratorSample(metric, 0, { node: "gpu-a" }, 1040),
        makeAcceleratorSample(metric, 6 * 1024 ** 3, { node: "gpu-a" }, 1000),
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

it("colours an Endpoint by name so it keeps its colour across GPUs", () => {
  // The largest allocation always takes the first colour.
  expect(allocationColor("any", 0)).toBe(chartCategoryMark(0).color);
  const second = ["a", "b", "c", "d", "e"].map((name) =>
    allocationColor(name, 1),
  );
  expect(new Set(second).size).toBeGreaterThan(1);
  expect(second).not.toContain(chartCategoryMark(0).color);
  // Hashed colours stay on the solid main sequence; past the palette is More.
  for (const color of second)
    expect(color).not.toMatch(/--nt-chart-cat-[78]\)/);
  expect(allocationColor("a", 8)).toBe(CHART_MORE_COLOR);
});

it.each([
  {
    name: "splits a known reservation",
    reservation: {
      memoryMiB: 100,
      modelWeightsMiB: 20,
      kvCacheCapacityMiB: 50,
    },
    actual: 80,
    expected: {
      weightsPct: 20,
      kvPct: 50,
      otherPct: 30,
      otherMiB: 30,
      actualPct: 80,
    },
  },
  {
    name: "caps weights and KV at the reservation",
    reservation: {
      memoryMiB: 100,
      modelWeightsMiB: 70,
      kvCacheCapacityMiB: 50,
    },
    actual: 150,
    expected: {
      weightsPct: 70,
      kvPct: 30,
      otherPct: 0,
      otherMiB: 0,
      actualPct: 100,
    },
  },
  {
    name: "leaves an unknown split empty",
    reservation: {
      memoryMiB: 100,
      modelWeightsMiB: 20,
      kvCacheCapacityMiB: null,
    },
    actual: null,
    expected: {
      weightsPct: 0,
      kvPct: 0,
      otherPct: 0,
      otherMiB: null,
      actualPct: null,
    },
  },
  {
    name: "has no percentages without a reservation",
    reservation: { memoryMiB: 0, modelWeightsMiB: 0, kvCacheCapacityMiB: 0 },
    actual: 10,
    expected: {
      weightsPct: 0,
      kvPct: 0,
      otherPct: 0,
      otherMiB: 0,
      actualPct: null,
    },
  },
])("allocationComposition $name", ({ reservation, actual, expected }) => {
  expect(allocationComposition(reservation, actual)).toEqual(expected);
});

it.each([
  { ages: [], expected: null },
  { ages: [30, 90], expected: { seconds: 30, stale: false } },
  { ages: [2 * 3600 + 1], expected: { seconds: 2 * 3600 + 1, stale: true } },
])("sampleAge of samples aged $ages -> $expected", ({ ages, expected }) => {
  const now = 10_000_000;
  expect(
    sampleAge(now * 1000, [
      undefined,
      ...ages.map((age) => makeAcceleratorSample(metric, 0, {}, now - age)),
    ]),
  ).toEqual(expected);
});

it.each([
  { key: "nvlink", value: "1", shown: true },
  { key: "nvswitch", value: "0", shown: false },
  { key: "nvlink", value: "2", shown: null },
  { key: "pcie_generation", value: "5", shown: "Gen 5" },
  { key: "pcie_width", value: "16", shown: "x16" },
  { key: "pcie_width", value: "", shown: null },
  { key: "architecture", value: "Hopper", shown: "Hopper" },
  { key: "numa_node", value: "-1", shown: null },
  { key: "architecture", value: "unknown", shown: null },
])("hardwareValue $key=$value -> $shown", ({ key, value, shown }) => {
  expect(hardwareValue({ [key]: value }, key)).toBe(shown);
});

it.each([
  {
    onCard: 2,
    total: 4,
    vdevice: undefined,
    expected: { kind: "ofTotal", onCard: 2, total: 4 },
  },
  {
    onCard: 1,
    total: 3,
    vdevice: "1",
    expected: { kind: "ofTotal", onCard: 1, total: 3 },
  },
  {
    onCard: 2,
    total: undefined,
    vdevice: undefined,
    expected: { kind: "count", count: 2 },
  },
  {
    onCard: 1,
    total: 1,
    vdevice: "1",
    expected: { kind: "vgpu", vdevice: "1" },
  },
  { onCard: 1, total: 1, vdevice: undefined, expected: null },
])(
  "replicaSummary of $onCard on card of $total",
  ({ onCard, total, vdevice, expected }) => {
    const [group] = groupGpuAllocationsByEndpoint(
      Array.from({ length: onCard }, (_, index) => ({
        ...allocation,
        replica: `pod-${index}`,
        instance: `pod-${index}`,
        vdevice,
        endpointReplicas: total,
      })),
    );
    expect(replicaSummary(group)).toEqual(expected);
  },
);

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

it("totals the replicas that report usage and keeps the others unknown", () => {
  const [group] = groupGpuAllocationsByEndpoint([
    { ...allocation, replica: "pod-a", instance: "pod-a" },
    { ...allocation, replica: "pod-b", instance: "pod-b" },
  ]);
  const usage = replicaUsage(
    [sample(2 * 1024 ** 3, { replica: "pod-a", instance_id: "pod-a" })],
    group,
  );

  expect(usage.rows.map((row) => row.usedMiB)).toEqual([2048, null]);
  expect(usage.usedMiB).toBe(2048);
  expect(replicaUsage([], group).usedMiB).toBeNull();
});
