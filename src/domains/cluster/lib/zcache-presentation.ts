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

export function operationLabel(kind?: string) {
  switch (kind) {
    case "install":
      return "clusters.zcache.actions.install";
    case "add_nodes":
      return "clusters.zcache.actions.addNodes";
    case "remove_nodes":
      return "clusters.zcache.actions.removeNodes";
    case "update_cache":
      return "clusters.zcache.actions.capacity";
    default:
      return "clusters.zcache.actions.configure";
  }
}

export function operationPhase(phase?: string) {
  switch (phase) {
    case "Succeeded":
      return "clusters.zcache.operationSucceeded";
    case "Failed":
    case "Rejected":
      return "clusters.zcache.operationFailed";
    case "Running":
      return "clusters.zcache.operationRunning";
    case "Pending":
    case "Submitting":
      return "clusters.zcache.operationPending";
    default:
      return "clusters.zcache.unknown";
  }
}
