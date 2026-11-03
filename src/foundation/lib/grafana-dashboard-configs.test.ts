import { describe, expect, it } from "vitest";
import {
  type ClusterSplitDashboardType,
  type EndpointSplitDashboardType,
  GRAFANA_VAR_ALL,
  getClusterSplitDashboardProps,
  getEndpointSplitDashboardProps,
  getOverviewDashboardProps,
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
      });
      expect(props.hideVariables).toBe(dashboardType !== "cache");
    },
  );
});

it("applies a cache provider's dashboard only to the cache panel", () => {
  const context = {
    clusterName: "cluster-a",
    endpointName: "endpoint-a",
    cache: { dashboardId: "provider-cache", variables: { Workspace: "w" } },
  };
  const cache = getEndpointSplitDashboardProps(
    "http://grafana",
    "cache",
    context,
  );
  expect(cache.dashboardConfig.dashboardId).toBe("provider-cache");
  expect(cache.dashboardConfig.variables).toMatchObject({ Workspace: "w" });
  const overview = getEndpointSplitDashboardProps(
    "http://grafana",
    "overview",
    context,
  );
  expect(overview.dashboardConfig.dashboardId).toBe(
    "neutree-endpoint-overview-embed",
  );
  expect(overview.dashboardConfig.variables).not.toHaveProperty("Workspace");
});
