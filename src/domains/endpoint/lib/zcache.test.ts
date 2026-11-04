import { describe, expect, it } from "vitest";
import { endpointCacheDashboard } from "./zcache";

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
