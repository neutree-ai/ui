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
