import { describe, expect, it } from "vitest";
import type { ZCacheStatus } from "../types";
import { getZCacheDashboardProps } from "./zcache-dashboard";

const context = { workspace: "team-a", clusterName: "pool" };
const node = (name: string, capacity_bytes: number, runtime: string) => ({
  name,
  capacity_bytes,
  runtime,
  cache: "Ready",
});

describe("getZCacheDashboardProps", () => {
  it.each<{ name: string; status?: ZCacheStatus }>([
    { name: "no observation", status: undefined },
    {
      name: "a failed observation",
      status: {
        observed_at: "t",
        observation_error: "x",
        nodes: [node("node-a", 1024, "Ready")],
      },
    },
    { name: "an empty pool", status: { observed_at: "t", nodes: [] } },
  ])("leaves capacity and readiness empty for $name", ({ status }) => {
    const props = getZCacheDashboardProps("http://grafana", {
      ...context,
      status,
    });
    expect(props.dashboardConfig.dashboardId).toBe("neutree-zcache-embed");
    expect(props.dashboardConfig.variables).toMatchObject({
      Workspace: "team-a",
      Cluster: "pool",
      CacheCapacity: "(vector(0) > 0)",
      CacheReady: "(vector(0) > 0)",
    });
  });

  it("keeps each node's capacity and readiness", () => {
    const vars = getZCacheDashboardProps("http://grafana", {
      ...context,
      status: {
        observed_at: "t",
        nodes: [
          node("node-a", 1024, "Ready"),
          node("node-b", 2048, "NotReady"),
        ],
      },
    }).dashboardConfig.variables;
    expect(vars?.CacheCapacity).toBe(
      'label_replace(vector(1024), "node", "node-a", "", "") or label_replace(vector(2048), "node", "node-b", "", "")',
    );
    expect(vars?.CacheReady).toBe(
      'label_replace(vector(1), "node", "node-a", "", "") or label_replace(vector(0), "node", "node-b", "", "")',
    );
  });
});
