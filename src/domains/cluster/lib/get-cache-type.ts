import type { ModelCache } from "@/domains/cluster/types";

/**
 * Determine the cache type from a model cache object.
 * Priority: nfs > pvc > host_path (default).
 */
export function getCacheType(
  cache: Pick<ModelCache, "nfs" | "pvc" | "host_path">,
): "nfs" | "host_path" | "pvc" {
  if (cache.nfs) return "nfs";
  if (cache.pvc) return "pvc";
  return "host_path";
}
