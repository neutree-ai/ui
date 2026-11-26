import { describe, expect, it } from "vitest";
import type { Endpoint, EndpointClusterRef } from "../types";
import {
  acceleratorChoiceValue,
  type EndpointRequestCapacity,
  endpointEditCredit,
  endpointFormCluster,
  gpuCapacityMessages,
} from "./endpoint-form-capacity";

const T4 = { type: "nvidia_gpu", product: "Tesla-T4" };

const cluster = (
  spec: Partial<EndpointClusterRef["spec"]>,
  status: EndpointClusterRef["status"] = {},
) =>
  ({
    metadata: { name: "c" },
    spec: { type: "kubernetes", ...spec },
    status,
  }) as EndpointClusterRef;

describe("acceleratorChoiceValue", () => {
  it.each([
    [T4, "nvidia_gpu:Tesla-T4"],
    [{ type: "nvidia_gpu", product: "" }, ""],
    [null, ""],
  ])("%o -> %j", (accelerator, value) => {
    expect(acceleratorChoiceValue(accelerator)).toBe(value);
  });
});

describe("endpointFormCluster", () => {
  it.each([
    [cluster({ accelerator_virtualization: { enabled: true } }), true],
    [
      cluster({ type: "ssh", accelerator_virtualization: { enabled: true } }),
      false,
    ],
    [cluster({}), false],
  ])(
    "vGPU enabled only on a Kubernetes cluster that turns it on",
    (c, enabled) => {
      expect(endpointFormCluster(c).vgpuEnabled).toBe(enabled);
    },
  );

  it("counts nodes from the snapshot, falling back to ready nodes", () => {
    const nodes = { resource_info: { node_resources: { a: {}, b: {} } } };
    expect(
      endpointFormCluster(
        cluster({}, nodes as unknown as EndpointClusterRef["status"]),
      ).nodeCount,
    ).toBe(2);
    expect(endpointFormCluster(cluster({}, { ready_nodes: 3 })).nodeCount).toBe(
      3,
    );
    expect(endpointFormCluster(undefined).nodeCount).toBeNull();
  });
});

describe("endpointEditCredit", () => {
  const saved = { cpu: 2, memory: 4, gpu: 0, accelerator: null };
  const endpoint = (phase: string, replicas?: unknown[]) =>
    ({
      spec: { cluster: "c", replicas: { num: 1 } },
      status: { phase, resources: replicas ? { replicas } : undefined },
    }) as unknown as Endpoint;
  const credit = (
    e: Endpoint,
    resources = saved,
    overrides: Partial<Parameters<typeof endpointEditCredit>[0]> = {},
  ) =>
    endpointEditCredit({
      editing: true,
      endpoint: e,
      currentCluster: "c",
      cacheChanged: false,
      savedResources: saved,
      resources,
      replicaCount: 1,
      ...overrides,
    });

  it("needs no new capacity for a running endpoint asking for no more than it holds", () => {
    expect(credit(endpoint("Running")).needsNoNewCapacity).toBe(true);
  });

  it.each([
    ["a paused endpoint", endpoint("Paused"), saved, {}],
    ["more CPU", endpoint("Running"), { ...saved, cpu: 3 }, {}],
    ["another cluster", endpoint("Running"), saved, { currentCluster: "d" }],
    ["a changed cache", endpoint("Running"), saved, { cacheChanged: true }],
    ["a create", endpoint("Running"), saved, { editing: false }],
  ])("checks placement for %s", (_, e, resources, overrides) => {
    expect(credit(e, resources, overrides).needsNoNewCapacity).toBe(false);
  });

  it("credits the runtime replicas and saved per-replica figures on the same cluster", () => {
    const replicas = [{ node: "a" }];
    expect(credit(endpoint("Running", replicas))).toMatchObject({
      runtimeResources: { replicas },
      savedPerReplica: { cpuPerReplica: 2, memoryPerReplica: 4 },
      needsNoNewCapacity: false,
    });
    expect(
      credit(endpoint("Running", replicas), saved, { currentCluster: "d" }),
    ).toMatchObject({
      runtimeResources: undefined,
      savedPerReplica: undefined,
    });
  });
});

describe("gpuCapacityMessages", () => {
  const base = {
    hasAccelerator: true,
    isVgpuAllocationMode: false,
    isFullGpuCapacityExceeded: true,
    placementCapacity: { maxGpuPlaceableReplicas: 1 },
    requestedFullGpuCards: 4,
  };
  const messages = (c: Partial<EndpointRequestCapacity>, evidence = true) =>
    gpuCapacityMessages({ ...base, ...c } as EndpointRequestCapacity, {
      currentCluster: "c",
      cluster: { hasCapacityEvidence: evidence } as ReturnType<
        typeof endpointFormCluster
      >,
      accelerator: T4,
      replicaCount: 2,
    }).map(([key]) => key.replace("endpoints.messages.", ""));

  it.each([
    [{}, ["fullGpuResourcesInsufficient"]],
    [{ hasNoMatchingAccelerator: true }, ["noMatchingAccelerator"]],
    [
      { hasPartialGpuReplicaPlacement: true },
      ["fullGpuResourcesInsufficient", "partialGpuReplicaPlacement"],
    ],
    [
      { hasFullGpuAggregateCardCapacityExceeded: true },
      ["fullGpuCardCapacityInsufficient"],
    ],
    [
      {
        isVgpuAllocationMode: true,
        isVgpuCapacityExceeded: true,
        hasNoNodeForVgpuReplica: true,
      },
      ["noNodeCanScheduleVgpuRequest"],
    ],
    [{ isFullGpuCapacityExceeded: false }, []],
  ])("%o -> %j", (c, expected) => {
    expect(messages(c)).toEqual(expected);
  });

  it("says nothing without capacity evidence or a chosen accelerator", () => {
    expect(messages({}, false)).toEqual([]);
    expect(messages({ hasAccelerator: false })).toEqual([]);
  });
});
