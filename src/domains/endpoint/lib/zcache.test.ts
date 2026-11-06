import { describe, expect, it } from "vitest";
import type { EndpointClusterRef } from "../types";
import { endpointCacheDashboard, kvCacheUnavailableReason } from "./zcache";

const node = (name: string, capacity_bytes: number, runtime = "Ready") => ({
  name,
  capacity_bytes,
  runtime,
});
const observed = (nodes: ReturnType<typeof node>[]) => ({
  current: { enabled: true },
  nodes,
});

describe("endpointCacheDashboard", () => {
  it("uses the ZCache dashboard only for a ZCache endpoint", () => {
    expect(endpointCacheDashboard({ provider: "zcache" }).dashboardId).toBe(
      "neutree-endpoint-zcache-embed",
    );
    expect(endpointCacheDashboard({ provider: "other" }).dashboardId).toBe(
      undefined,
    );
  });

  it.each([
    { name: "no observation", cacheStatus: undefined },
    { name: "an empty pool", cacheStatus: observed([]) },
    { name: "a node without capacity", cacheStatus: observed([node("a", 0)]) },
    {
      name: "uneven capacities",
      cacheStatus: observed([node("a", 1024), node("b", 2048)]),
    },
    {
      name: "a disabled cache",
      cacheStatus: { current: { enabled: false }, nodes: [node("a", 2048)] },
    },
    {
      name: "a failed observation",
      cacheStatus: { ...observed([node("a", 2048)]), observation_error: "x" },
    },
  ])("reports 0 on no nodes for $name", ({ cacheStatus }) => {
    expect(
      endpointCacheDashboard({ provider: "zcache", cacheStatus }).variables,
    ).toMatchObject({ L1CapacityBytes: "0", L1Nodes: "a^" });
  });

  it("scopes a uniform pool of Ready nodes, escaping their names", () => {
    expect(
      endpointCacheDashboard({
        workspace: "team-b",
        provider: "zcache",
        cacheStatus: observed([
          node("worker.a", 2048),
          node("worker-b", 2048),
          node("worker-c", 1024, "NotReady"),
        ]),
      }).variables,
    ).toEqual({
      Workspace: "team-b",
      L1CapacityBytes: "2048",
      L1Nodes: "worker\\\\.a|worker-b",
    });
  });

  it("ignores cache nodes for another provider", () => {
    expect(
      endpointCacheDashboard({
        provider: "other",
        cacheStatus: observed([node("a", 2048)]),
      }).variables,
    ).toEqual({ Workspace: "default", L1CapacityBytes: "0", L1Nodes: "a^" });
  });
});

describe("kvCacheUnavailableReason", () => {
  const cluster = ({
    type = "kubernetes",
    enabled = true,
    version = "v1",
  } = {}) =>
    ({
      spec: {
        type,
        cache: { provider: "zcache", options: { enabled, version } },
      },
    }) as unknown as EndpointClusterRef;
  const versions = {
    isLoading: false,
    isError: false,
    engineVersions: ["v0.31.0"],
  };
  const supported = {
    cluster: cluster(),
    acceleratorType: "nvidia_gpu",
    engine: { engine: "vllm", version: "v0.31.0" },
    task: "text-generation",
    manager: { kind: "ready" as const },
    versions,
  };

  it.each<{
    name: string;
    args: Partial<Parameters<typeof kvCacheUnavailableReason>[0]>;
    reason: string | null;
  }>([
    { name: "a supported endpoint", args: {}, reason: null },
    { name: "no task yet", args: { task: undefined }, reason: null },
    {
      name: "an SSH cluster",
      args: { cluster: cluster({ type: "ssh" }) },
      reason: "unavailableCluster",
    },
    {
      name: "a cluster without the cache enabled",
      args: { cluster: cluster({ enabled: false }) },
      reason: "unavailableCluster",
    },
    {
      name: "no accelerator",
      args: { acceleratorType: "" },
      reason: "unavailableAccelerator",
    },
    {
      name: "a non-NVIDIA accelerator",
      args: { acceleratorType: "amd_gpu" },
      reason: "unavailableAcceleratorVendor",
    },
    {
      name: "a non-vLLM engine",
      args: { engine: { engine: "sglang", version: "v0.31.0" } },
      reason: "unavailableEngine",
    },
    {
      name: "an embedding task",
      args: { task: "text-embedding" },
      reason: "unavailableTask",
    },
    {
      name: "no runtime version",
      args: { cluster: cluster({ version: "" }) },
      reason: "unavailableRuntime",
    },
    {
      name: "a loading manager",
      args: { manager: { kind: "loading" } },
      reason: "checkingManager",
    },
    {
      name: "an unreported manager",
      args: { manager: { kind: "not-configured" } },
      reason: "unavailableManager",
    },
    {
      name: "a reconciling manager",
      args: { manager: { kind: "pending" } },
      reason: "managerPending",
    },
    {
      name: "a failed manager",
      args: { manager: { kind: "unavailable" } },
      reason: "managerUnavailable",
    },
    {
      name: "a failed version check",
      args: { versions: { ...versions, isError: true, isLoading: true } },
      reason: "unavailableRuntimeCheck",
    },
    {
      name: "a loading version check",
      args: { versions: { ...versions, isLoading: true } },
      reason: "checkingRuntime",
    },
    {
      name: "a runtime without engine versions",
      args: { versions: { ...versions, engineVersions: [] } },
      reason: "noCompatibleEngineVersion",
    },
    {
      name: "an unsupported engine version",
      args: { engine: { engine: "vllm", version: "v0.24.0" } },
      reason: "unavailableEngineVersion",
    },
  ])("$name -> $reason", ({ args, reason }) => {
    expect(kvCacheUnavailableReason({ ...supported, ...args })).toBe(
      reason && `endpoints.kvCacheSettings.${reason}`,
    );
  });
});
