/** An endpoint row projected down to what the cache dependency check reads. */
export type CacheDependentEndpoint = {
  id: number;
  name?: string | null;
  display_name?: string | null;
  kv_cache?: { provider: string } | null;
  observed_kv_cache?: {
    provider: string;
    details?: { in_use?: boolean } | null;
  } | null;
};

/** PostgREST projection matching {@link CacheDependentEndpoint}. */
export const CACHE_DEPENDENT_SELECT =
  "id,name:metadata->>name,display_name:metadata->>display_name,kv_cache:spec->kv_cache,observed_kv_cache:status->kv_cache";

/**
 * Labels of the endpoints reported as actively using ZCache, deduplicated.
 */
export function cacheDependents(endpoints: CacheDependentEndpoint[]) {
  const labels = endpoints
    .filter(
      (endpoint) =>
        endpoint.observed_kv_cache?.provider === "zcache" &&
        endpoint.observed_kv_cache.details?.in_use === true,
    )
    .map(
      (endpoint) =>
        endpoint.display_name || endpoint.name || String(endpoint.id),
    );
  return [...new Set(labels)];
}

type CacheDependencyCheck = {
  inUse: boolean;
  loading: boolean;
  error: boolean;
};

/** Removal stays blocked until the check proves no endpoint uses the cache. */
export function cacheRemovalBlocked({
  inUse,
  loading,
  error,
}: CacheDependencyCheck) {
  return inUse || loading || error;
}

/**
 * Whether a node's checkbox can change, and whether its row lists the
 * dependent endpoints. Only nodes the cache service has applied are
 * protected; a saved node that never took effect can be withdrawn (mirrors
 * the database guard). New nodes need a selectable, freshly observed candidate.
 */
export function nodeSelectionState({
  nodeName,
  selected,
  applied,
  selectable,
  inventoryStale,
  dependencies,
}: {
  nodeName: string;
  selected: string[];
  applied: string[];
  selectable: boolean;
  inventoryStale: boolean;
  dependencies: CacheDependencyCheck;
}) {
  const isSelected = selected.includes(nodeName);
  const isApplied = applied.includes(nodeName);
  return {
    selected: isSelected,
    disabled:
      (isApplied && cacheRemovalBlocked(dependencies)) ||
      (!isSelected && (!selectable || inventoryStale)),
    showDependents: isApplied && (dependencies.inUse || dependencies.error),
  };
}
