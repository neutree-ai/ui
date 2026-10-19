import type { ZCacheSpec, ZCacheStatus } from "../types";

export function sameCacheConfig(a?: ZCacheSpec, b?: ZCacheSpec) {
  if (!a?.enabled && !b?.enabled) return true;
  return (
    !!a?.enabled &&
    !!b?.enabled &&
    a.l1_size_gib === b.l1_size_gib &&
    [...a.target_nodes].sort().join("\n") ===
      [...b.target_nodes].sort().join("\n")
  );
}

// A submission can still be resolving an ambiguous response even when the
// overall reconciliation has reported an error. Do not promise cancellation.
export function activeCacheChange(status?: ZCacheStatus) {
  const change = status?.change;
  if (!change || ["Succeeded", "Failed", "Rejected"].includes(change.phase))
    return undefined;
  return change;
}

