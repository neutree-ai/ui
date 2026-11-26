import type { CrudFilter } from "@refinedev/core";
import type { Metadata } from "@/foundation/types/basic-types";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";
import type { Endpoint, EndpointClusterRef, ResourceSpec } from "../types";
import { kvCacheTimeoutSeconds } from "./endpoint-display-summary";
import { getVgpuVirtualization } from "./vgpu";
import { endpointZCacheOptions } from "./zcache";

/** A paused or deleted endpoint runs nothing to observe. */
export const isEndpointInactive = (endpoint: Endpoint | undefined) =>
  endpoint?.status?.phase === "Paused" || endpoint?.status?.phase === "Deleted";

/**
 * The detail page's lookups: the engine by name, the endpoint's cluster by
 * name, and the endpoints sharing that cluster; each waits for its key.
 */
export function endpointShowQueries(endpoint: Endpoint | undefined) {
  const engine = endpoint?.spec.engine.engine;
  const cluster = endpoint?.spec.cluster;
  const workspace = endpoint?.metadata.workspace;
  const meta = { workspace, workspaced: true };
  const byCluster = (field: string): CrudFilter[] => [
    { field, operator: "eq", value: JSON.stringify(cluster) },
  ];
  return {
    engine: { id: engine, enabled: Boolean(engine) },
    cluster: {
      meta,
      filters: byCluster("metadata->name"),
      enabled: Boolean(cluster),
    },
    clusterEndpoints: {
      meta,
      filters: byCluster("spec->cluster"),
      enabled: Boolean(workspace && cluster),
    },
  };
}

/** The Ray dashboard page of the endpoint's Serve application, named `<workspace>_<name>`. */
export const rayServeApplicationUrl = (
  dashboardUrl: string,
  endpoint: Endpoint,
) =>
  `${dashboardUrl}#/serve/applications/${endpoint.metadata.workspace}_${endpoint.metadata.name}`;

/** The engine version the endpoint runs, among its engine's versions. */
export const endpointEngineVersion = <V extends { version: string }>(
  versions: V[] | undefined,
  endpoint: Endpoint,
) => versions?.find((v) => v.version === endpoint.spec.engine.version);

/**
 * Engine arguments as the detail page shows them: the stored ones plus, on a
 * ZCache endpoint, the kv_transfer_config the provider reports.
 */
export function shownEngineParameters(
  endpoint: Endpoint,
): Record<string, unknown> {
  const kvCache = endpoint.status?.kv_cache;
  const kvTransferConfig =
    kvCache?.provider === "zcache"
      ? kvCache.details?.kv_transfer_config
      : undefined;
  return {
    ...(endpoint.spec.variables?.engine_args as
      | Record<string, unknown>
      | undefined),
    ...(kvTransferConfig ? { kv_transfer_config: kvTransferConfig } : {}),
  };
}

/** How the runtime card names the endpoint: a missing workspace is default, a model-free endpoint names no model. */
export const runtimeCardIdentity = (endpoint: Endpoint) => ({
  endpointName: endpoint.metadata.name,
  workspace: endpoint.metadata.workspace ?? "default",
  modelName: endpoint.spec.model?.name ?? "",
});

/** The vGPU core share each card is requested with, if any. */
export const requestedCorePercent = (
  resources: ResourceSpec | null | undefined,
) => getVgpuVirtualization(resources?.accelerator)?.core_percent ?? undefined;

/** A placed device as its cluster reports it, matched by UUID on its node. */
export const clusterDeviceOf = (
  info: ClusterResourceInfo | null | undefined,
  nodeId: string,
  uuid: string | undefined,
) =>
  info?.node_resources?.[nodeId]?.devices?.find(
    (candidate) => candidate.uuid === uuid,
  );

/** Container names that hold an engine: every listed engine, or the endpoint's own before the list loads. */
export const engineContainerNames = (
  engines: { metadata: Metadata }[] | undefined,
  endpoint: Endpoint,
) =>
  new Set(
    engines?.map((engine) => engine.metadata.name) ?? [
      endpoint.spec.engine.engine,
    ],
  );

/**
 * The detail page's KV cache section, or null when hidden: it needs ZCache on
 * the cluster, and an endpoint on another provider shows nothing.
 */
export function endpointKVCacheSummary(
  endpoint: Endpoint,
  cluster: EndpointClusterRef | undefined,
) {
  const enabled = endpoint.spec.kv_cache?.provider === "zcache";
  if (
    !cluster ||
    endpointZCacheOptions(cluster)?.enabled !== true ||
    (endpoint.spec.kv_cache && !enabled)
  ) {
    return null;
  }
  const workspace = encodeURIComponent(
    endpoint.metadata.workspace ?? "default",
  );
  return {
    enabled,
    timeoutSeconds: kvCacheTimeoutSeconds(endpoint.spec.kv_cache),
    clusterName: cluster.metadata.name,
    clusterCacheHref: `/${workspace}/clusters/show/${encodeURIComponent(cluster.metadata.name)}?section=cache`,
  };
}
