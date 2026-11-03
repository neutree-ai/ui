import { describe, expect, it } from "vitest";
import {
  type ClusterSplitDashboardType,
  type EndpointSplitDashboardType,
  GRAFANA_VAR_ALL,
  getClusterSplitDashboardProps,
  getEndpointSplitDashboardProps,
  getOverviewDashboardProps,
  getZCacheDashboardProps,
} from "./grafana-dashboard-configs";

describe("getOverviewDashboardProps", () => {
  it("uses the split overview dashboard with all clusters selected", () => {
    const props = getOverviewDashboardProps("http://grafana");

    expect(props.dashboardConfig.dashboardId).toBe("neutree-overview-embed");
    expect(props.dashboardConfig.variables).toMatchObject({
      datasource: "neutree-cluster",
      Cluster: GRAFANA_VAR_ALL,
    });
  });
});

describe("getClusterSplitDashboardProps", () => {
  it.each([["overview", "neutree-cluster-overview-embed"]] as Array<
    [ClusterSplitDashboardType, string]
  >)(
    "uses %s split dashboard UID and cluster variable",
    (dashboardType, dashboardId) => {
      const props = getClusterSplitDashboardProps(
        "http://grafana",
        dashboardType,
        "cluster-a",
      );

      expect(props.dashboardConfig.dashboardId).toBe(dashboardId);
      expect(props.dashboardConfig.variables).toEqual({
        datasource: "neutree-cluster",
        Cluster: "cluster-a",
      });
    },
  );
});

describe("getEndpointSplitDashboardProps", () => {
  it.each([
    ["overview", "neutree-endpoint-overview-embed"],
    ["latency", "neutree-endpoint-latency-embed"],
    ["throughput", "neutree-endpoint-token-latency-embed"],
    ["queue", "neutree-endpoint-queue-embed"],
    ["cache", "neutree-endpoint-cache-embed"],
  ] as Array<[EndpointSplitDashboardType, string]>)(
    "uses %s split dashboard UID and endpoint variables",
    (dashboardType, dashboardId) => {
      const props = getEndpointSplitDashboardProps(
        "http://grafana",
        dashboardType,
        {
          clusterName: "cluster-a",
          endpointName: "endpoint-a",
        },
      );

      expect(props.dashboardConfig.dashboardId).toBe(dashboardId);
      expect(props.dashboardConfig.variables).toEqual({
        datasource: "neutree-cluster",
        Cluster: "cluster-a",
        Endpoint: "endpoint-a",
        ...(dashboardType === "cache"
          ? { Workspace: "default", L1CapacityBytes: "0", L1Nodes: "a^" }
          : {}),
      });
    },
  );
});

describe("cache dashboard scope", () => {
  const node = (name: string, capacity_bytes: number) => ({
    name,
    capacity_bytes,
  });
  it.each([
    [undefined, "0", "a^"],
    [[], "0", "a^"],
    [[node("worker-a", 0)], "0", "a^"],
    [[node("worker-a", 1024), node("worker-b", 2048)], "0", "a^"],
    [
      [node("worker.a", 2048), node("worker-b", 2048)],
      "2048",
      "worker\\\\.a|worker-b",
    ],
  ] as const)(
    "routes ZCache and derives usable capacity from %j",
    (cacheNodes, capacity, nodes) => {
      const context = {
        workspace: "team-b",
        clusterName: "cluster-a",
        endpointName: "model",
        cacheProvider: "zcache",
        cacheNodes: cacheNodes ? [...cacheNodes] : undefined,
      };
      const cache = getEndpointSplitDashboardProps(
        "http://grafana",
        "cache",
        context,
      );
      expect(cache.dashboardConfig.dashboardId).toBe(
        "neutree-endpoint-zcache-embed",
      );
      expect(cache.dashboardConfig.variables).toMatchObject({
        Workspace: "team-b",
        L1CapacityBytes: capacity,
        L1Nodes: nodes,
      });
      expect(
        getEndpointSplitDashboardProps("http://grafana", "overview", context)
          .dashboardConfig.dashboardId,
      ).toBe("neutree-endpoint-overview-embed");
    },
  );

  it("preserves per-node capacity and readiness, with unavailable expressions for an empty pool", () => {
    const context = { workspace: "team-a", clusterName: "pool" };
    const empty = getZCacheDashboardProps("http://grafana", context);
    expect(empty.dashboardConfig.dashboardId).toBe("neutree-zcache-embed");
    expect(empty.dashboardConfig.variables).toMatchObject({
      CacheCapacity: "(vector(0) > 0)",
      CacheReady: "(vector(0) > 0)",
    });
    const vars = getZCacheDashboardProps("http://grafana", {
      ...context,
      nodes: [
        { name: "node-a", capacity_bytes: 1024, runtime: "Ready" },
        { name: "node-b", capacity_bytes: 2048, runtime: "NotReady" },
      ],
    }).dashboardConfig.variables;
    expect(vars?.CacheCapacity).toContain("vector(1024)");
    expect(vars?.CacheCapacity).toContain("vector(2048)");
    expect(vars?.CacheReady).toContain("vector(1)");
    expect(vars?.CacheReady).toContain("vector(0)");
  });
});
