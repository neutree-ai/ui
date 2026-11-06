import { describe, expect, it } from "vitest";
import type { EndpointClusterRef } from "../types";
import { endpointCacheDashboard, zcacheSupport } from "./zcache";

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

describe("zcacheSupport", () => {
  const cluster = (type = "kubernetes", enabled = true) =>
    ({
      spec: { type, cache: { provider: "zcache", options: { enabled } } },
    }) as unknown as EndpointClusterRef;
  const vllm = (version = "v0.31.0") => ({ engine: "vllm", version });

  it.each([
    { name: "a supported vLLM version", args: {}, expected: "ok" },
    {
      name: "an unsupported vLLM version",
      args: { engine: vllm("v0.24.0") },
      expected: "incompatible",
    },
    {
      name: "an SSH cluster",
      args: { cluster: cluster("ssh") },
      expected: "requirements",
    },
    {
      name: "a cluster without the cache enabled",
      args: { cluster: cluster("kubernetes", false) },
      expected: "requirements",
    },
    {
      name: "a non-vLLM engine",
      args: { engine: { engine: "llama-cpp", version: "v0.31.0" } },
      expected: "requirements",
    },
    {
      name: "an embedding task",
      args: { task: "text-embedding" },
      expected: "requirements",
    },
  ])("$name -> $expected", ({ args, expected }) => {
    expect(
      zcacheSupport({
        cluster: cluster(),
        engine: vllm(),
        supportedEngineVersions: ["v0.31.0"],
        ...args,
      }),
    ).toBe(expected);
  });
});
