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
  it("passes observed node capacity and escapes node names for the PromQL regex", () => {
    const cache = getEndpointSplitDashboardProps("http://grafana", "cache", {
      clusterName: "cluster-a",
      endpointName: "model",
      cacheNodes: [
        { name: "worker.a", capacity_bytes: 2 ** 31 },
        { name: "worker-b", capacity_bytes: 2 ** 31 },
      ],
    });
    expect(cache.dashboardConfig.variables).toMatchObject({
      L1CapacityBytes: String(2 ** 31),
      L1Nodes: "worker\\\\.a|worker-b",
    });
  });

  it.each([
    [{ name: "worker-a", capacity_bytes: 0 }],
    [
      { name: "worker-a", capacity_bytes: 2 ** 31 },
      { name: "worker-b", capacity_bytes: 2 ** 32 },
    ],
  ])(
    "leaves unknown or mixed-capacity inventories unavailable",
    (...cacheNodes) => {
      const cache = getEndpointSplitDashboardProps("http://grafana", "cache", {
        clusterName: "cluster-a",
        endpointName: "model",
        cacheNodes,
      });
      expect(cache.dashboardConfig.variables).toMatchObject({
        L1CapacityBytes: "0",
        L1Nodes: "a^",
      });
    },
  );

  it("keeps identical names in different workspaces distinct", () => {
    const cache = getEndpointSplitDashboardProps("http://grafana", "cache", {
      workspace: "team-b",
      clusterName: "shared-name",
      endpointName: "model",
    });
    expect(cache.dashboardConfig.variables).toMatchObject({
      Workspace: "team-b",
      Cluster: "shared-name",
      Endpoint: "model",
    });
    const pool = getZCacheDashboardProps("http://grafana", {
      workspace: "team-b",
      clusterName: "shared-name",
    });
    expect(pool.dashboardConfig.dashboardId).toBe("neutree-zcache-embed");
    expect(pool.dashboardConfig.variables).toEqual({
      datasource: "neutree-cluster",
      Workspace: "team-b",
      Cluster: "shared-name",
      CacheCapacity: "(vector(0) > 0)",
      CacheReady: "(vector(0) > 0)",
    });
  });

  it("preserves different observed node capacities and readiness", () => {
    const vars = getZCacheDashboardProps("http://grafana", {
      workspace: "team-a",
      clusterName: "pool",
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
