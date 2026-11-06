import type { EndpointCacheDashboard } from "@/foundation/lib/grafana-dashboard-configs";
import type { EndpointClusterRef } from "../types";

// The endpoint only needs cache availability and node placement, not the
// cluster management UI's control-plane and operation types.
export function endpointZCacheOptions(
  cluster?: EndpointClusterRef,
): { enabled: boolean; version?: string; target_nodes?: string[] } | undefined {
  return cluster?.spec.cache?.provider === "zcache"
    ? (cluster.spec.cache.options as {
        enabled: boolean;
        version?: string;
        target_nodes?: string[];
      })
    : undefined;
}

type ObservedCacheNode = {
  name: string;
  runtime: string;
  capacity_bytes: number;
};

const ZCACHE_ENDPOINT_DASHBOARD_ID = "neutree-endpoint-zcache-embed";
// A regex that matches no node name, for a pool with no usable capacity.
const NO_NODE = "a^";

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The cache panel's dashboard and variables. ZCache has its own dashboard, fed
 * the per-node L1 capacity of the cluster's Ready cache nodes. One capacity
 * value is only meaningful for a uniform pool, so a mixed, unobserved or empty
 * pool reports 0 on no nodes rather than an average.
 */
export function endpointCacheDashboard({
  workspace,
  provider,
  cacheStatus,
}: {
  workspace?: string | null;
  provider?: string;
  cacheStatus?: {
    current?: { enabled: boolean };
    observation_error?: string;
    nodes?: ObservedCacheNode[];
  };
}): EndpointCacheDashboard {
  const zcache = provider === "zcache";
  const nodes =
    zcache && cacheStatus?.current?.enabled && !cacheStatus.observation_error
      ? (cacheStatus.nodes ?? []).filter((node) => node.runtime === "Ready")
      : [];
  const capacity = nodes[0]?.capacity_bytes ?? 0;
  const uniform =
    Number.isSafeInteger(capacity) &&
    capacity > 0 &&
    nodes.every((node) => node.name && node.capacity_bytes === capacity);
  const nodePattern = uniform
    ? nodes.map((node) => escapeRegExp(node.name)).join("|")
    : NO_NODE;
  return {
    dashboardId: zcache ? ZCACHE_ENDPOINT_DASHBOARD_ID : undefined,
    variables: {
      Workspace: workspace ?? "default",
      L1CapacityBytes: String(uniform ? capacity : 0),
      // Grafana substitutes the value into a PromQL string literal, so the
      // regex's backslashes are escaped once more.
      L1Nodes: JSON.stringify(nodePattern).slice(1, -1),
    },
  };
}

type ZCacheSupport = "ok" | "requirements" | "incompatible";

/**
 * Whether an endpoint can use the cluster's ZCache. The structural
 * requirements (Kubernetes, cache enabled, vLLM text generation) are checked
 * before the engine version, so "incompatible" only means the engine version
 * is not one the cluster's cache runtime supports.
 */
export function zcacheSupport({
  cluster,
  engine,
  task,
  supportedEngineVersions,
}: {
  cluster?: EndpointClusterRef;
  engine?: { engine?: string; version?: string };
  task?: string;
  supportedEngineVersions: string[];
}): ZCacheSupport {
  if (
    cluster?.spec.type !== "kubernetes" ||
    !endpointZCacheOptions(cluster)?.enabled ||
    engine?.engine !== "vllm" ||
    (task && task !== "text-generation")
  )
    return "requirements";
  return engine.version && supportedEngineVersions.includes(engine.version)
    ? "ok"
    : "incompatible";
}
