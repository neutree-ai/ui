import { describe, expect, it } from "vitest";
import {
  GRAFANA_VAR_ALL,
  getEndpointDashboardProps,
  getVllmDashboardProps,
} from "./grafana-dashboard-configs";

describe("getEndpointDashboardProps", () => {
  it("should default Replica to $__all when no replica specified", () => {
    const props = getEndpointDashboardProps(
      "http://grafana",
      "ep1",
      "cluster1",
    );
    expect(props.dashboardConfig.variables!.Replica).toBe(GRAFANA_VAR_ALL);
  });

  it("should set Replica to specific value when replica is provided", () => {
    const props = getEndpointDashboardProps(
      "http://grafana",
      "ep1",
      "cluster1",
      "replica-abc",
    );
    expect(props.dashboardConfig.variables!.Replica).toBe("replica-abc");
  });

  it("should set correct dashboard ID and other variables", () => {
    const props = getEndpointDashboardProps(
      "http://grafana",
      "my-endpoint",
      "my-cluster",
    );
    expect(props.dashboardConfig.dashboardId).toBe(
      "rayServeDeploymentDashboard",
    );
    expect(props.dashboardConfig.variables!.Application).toBe("my-endpoint");
    expect(props.dashboardConfig.variables!.Cluster).toBe("my-cluster");
    expect(props.dashboardConfig.variables!.Deployment).toBe(GRAFANA_VAR_ALL);
    expect(props.dashboardConfig.variables!.Route).toBe(GRAFANA_VAR_ALL);
  });
});

describe("getVllmDashboardProps", () => {
  it("should default Replica to $__all when no replica specified", () => {
    const props = getVllmDashboardProps("http://grafana", "ep1", "cluster1");
    expect(props.dashboardConfig.variables!.Replica).toBe(GRAFANA_VAR_ALL);
  });

  it("should set Replica to specific value when replica is provided", () => {
    const props = getVllmDashboardProps(
      "http://grafana",
      "ep1",
      "cluster1",
      "replica-xyz",
    );
    expect(props.dashboardConfig.variables!.Replica).toBe("replica-xyz");
  });

  it("should set correct dashboard ID and other variables", () => {
    const props = getVllmDashboardProps(
      "http://grafana",
      "my-endpoint",
      "my-cluster",
    );
    expect(props.dashboardConfig.dashboardId).toBe("vllm");
    expect(props.dashboardConfig.variables!.Application).toBe("my-endpoint");
    expect(props.dashboardConfig.variables!.Cluster).toBe("my-cluster");
  });
});
