import type { GrafanaDashboardProps } from "@/foundation/components/GrafanaDashboard";
import {
  getBaseDashboardConfig,
  getCommonVariables,
} from "@/foundation/lib/grafana-dashboard-configs";
import type { ZCacheStatus } from "../types";

type CacheNode = NonNullable<ZCacheStatus["nodes"]>[number];

const ZCACHE_DASHBOARD_ID = "neutree-zcache-embed";
// A PromQL expression with no series, for a pool with no usable nodes.
const NO_SERIES = "(vector(0) > 0)";

// One constant series per node, labelled with the node name, so the dashboard
// can join it with the per-node cache metrics.
const nodeVector = (nodes: CacheNode[], value: (node: CacheNode) => number) =>
  nodes
    .map(
      (node) =>
        `label_replace(vector(${value(node)}), "node", ${JSON.stringify(node.name)}, "", "")`,
    )
    .join(" or ") || NO_SERIES;

/**
 * The cluster's ZCache dashboard. Node capacity and readiness come from the
 * last successful cache observation; a failed or missing one leaves both
 * empty rather than showing stale nodes.
 */
export const getZCacheDashboardProps = (
  grafanaUrl: string,
  context: { workspace: string; clusterName: string; status?: ZCacheStatus },
): GrafanaDashboardProps => {
  const { status } = context;
  const nodes = (
    status?.observed_at && !status.observation_error ? (status.nodes ?? []) : []
  ).filter((node) => node.name);
  return {
    dashboardConfig: {
      ...getBaseDashboardConfig(grafanaUrl),
      dashboardId: ZCACHE_DASHBOARD_ID,
      variables: {
        ...getCommonVariables(),
        Workspace: context.workspace,
        Cluster: context.clusterName,
        CacheCapacity: nodeVector(
          nodes.filter(
            (node) =>
              Number.isSafeInteger(node.capacity_bytes) &&
              node.capacity_bytes > 0,
          ),
          (node) => node.capacity_bytes,
        ),
        CacheReady: nodeVector(nodes, (node) =>
          node.runtime === "Ready" ? 1 : 0,
        ),
      },
    },
    hideVariables: false,
  };
};
