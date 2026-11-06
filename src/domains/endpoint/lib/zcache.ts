import type { EndpointCacheDashboard } from "@/foundation/lib/grafana-dashboard-configs";
import type { EndpointClusterRef } from "../types";
import type { EndpointCacheManagerStatus } from "./cache-manager-status";

// The endpoint only needs cache availability and node placement, not the
// cluster management UI's control-plane and operation types.
export function endpointZCacheOptions(cluster?: EndpointClusterRef):
  | {
      enabled: boolean;
      version?: string;
      target_nodes?: string[];
      l1_size_gib?: number;
    }
  | undefined {
  if (cluster?.spec.cache?.provider !== "zcache") return undefined;

  const options = cluster.spec.cache.options as {
    enabled?: boolean;
    version?: string;
    target_nodes?: string[];
    l1_size_gib?: number;
  };

  return {
    enabled: options.enabled === true,
    version: options.version,
    target_nodes: options.target_nodes,
    l1_size_gib: options.l1_size_gib,
  };
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

/**
 * The i18n key explaining why an endpoint cannot enable ZCache, or null when
 * it can. Requirements are checked in the order a user fixes them: cluster,
 * accelerator, engine and task, then the cluster's cache runtime and manager,
 * and last the engine version the runtime supports.
 */
export function kvCacheUnavailableReason({
  cluster,
  acceleratorType,
  engine,
  task,
  manager,
  versions,
}: {
  cluster?: EndpointClusterRef;
  acceleratorType?: string | null;
  engine?: { engine?: string; version?: string };
  task?: string;
  manager: Pick<EndpointCacheManagerStatus, "kind">;
  versions: { isLoading: boolean; isError: boolean; engineVersions: string[] };
}): string | null {
  const options = endpointZCacheOptions(cluster);
  if (cluster?.spec.type !== "kubernetes" || !options?.enabled)
    return "endpoints.kvCacheSettings.unavailableCluster";
  if (!acceleratorType)
    return "endpoints.kvCacheSettings.unavailableAccelerator";
  if (!acceleratorType.toLowerCase().includes("nvidia"))
    return "endpoints.kvCacheSettings.unavailableAcceleratorVendor";
  if (engine?.engine !== "vllm")
    return "endpoints.kvCacheSettings.unavailableEngine";
  if (task && task !== "text-generation")
    return "endpoints.kvCacheSettings.unavailableTask";
  if (!options.version) return "endpoints.kvCacheSettings.unavailableRuntime";
  switch (manager.kind) {
    case "loading":
      return "endpoints.kvCacheSettings.checkingManager";
    case "not-configured":
      return "endpoints.kvCacheSettings.unavailableManager";
    case "pending":
      return "endpoints.kvCacheSettings.managerPending";
    case "unavailable":
      return "endpoints.kvCacheSettings.managerUnavailable";
  }
  if (versions.isError)
    return "endpoints.kvCacheSettings.unavailableRuntimeCheck";
  if (versions.isLoading) return "endpoints.kvCacheSettings.checkingRuntime";
  if (versions.engineVersions.length === 0)
    return "endpoints.kvCacheSettings.noCompatibleEngineVersion";
  if (!engine.version || !versions.engineVersions.includes(engine.version))
    return "endpoints.kvCacheSettings.unavailableEngineVersion";
  return null;
}
