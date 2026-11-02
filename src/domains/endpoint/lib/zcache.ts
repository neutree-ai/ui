import type { EndpointClusterRef } from "../types";

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
