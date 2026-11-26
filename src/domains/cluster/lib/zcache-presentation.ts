import type { ClusterCacheStatus, ZCacheSpec, ZCacheStatus } from "../types";

export function sameCacheConfig(a?: ZCacheSpec, b?: ZCacheSpec) {
  if (!a?.enabled && !b?.enabled) return true;
  return (
    !!a?.enabled &&
    !!b?.enabled &&
    (!a.version || a.version === b.version) &&
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

type ZCachePhase = ClusterCacheStatus["phase"];
type ZCacheAvailability = "available" | "unavailable" | "unknown";

type ZCacheViewState = {
  activeChange: ReturnType<typeof activeCacheChange>;
  availability: ZCacheAvailability;
  basePhase: ZCachePhase;
  desiredEnabled: boolean;
  phase: ZCachePhase;
  /** The provider reports a failure a fresh retry request may clear. */
  retryable: boolean;
  /** The per-node capacity an active capacity update applies. */
  changeCapacityGiB?: number;
  resultLabelKey:
    | "clusters.zcache.applied"
    | "clusters.zcache.disabled"
    | "clusters.zcache.failed"
    | "clusters.zcache.reconciling"
    | "clusters.zcache.unavailable"
    | "clusters.zcache.unknown";
  stale: boolean;
};

/**
 * The provider reports one lifecycle phase plus independent conditions.
 * Observation trust and active work are not phases, so keep them separate.
 */
export function resolveZCacheState({
  desired,
  status,
  summary,
}: {
  desired?: ZCacheSpec;
  status?: ZCacheStatus;
  summary?: ClusterCacheStatus;
}): ZCacheViewState {
  const ready = summary?.conditions?.find(
    (condition) => condition.type === "Ready",
  );
  const availability: ZCacheAvailability =
    ready?.status === "True"
      ? "available"
      : ready?.status === "False"
        ? "unavailable"
        : "unknown";
  const basePhase = summary?.phase ?? "Disabled";
  const phase =
    (basePhase === "Ready" || basePhase === "Disabled") &&
    !sameCacheConfig(desired, status?.current)
      ? "Reconciling"
      : basePhase;
  const stale = ready?.status === "Unknown" || !status?.observed_at;
  const resultLabelKey =
    phase === "Failed"
      ? "clusters.zcache.failed"
      : phase === "Disabled"
        ? "clusters.zcache.disabled"
        : phase === "Ready"
          ? "clusters.zcache.applied"
          : phase === "Unavailable"
            ? availability === "unavailable"
              ? "clusters.zcache.unavailable"
              : "clusters.zcache.unknown"
            : "clusters.zcache.reconciling";
  const activeChange = activeCacheChange(status);
  const request = activeChange?.request;
  const controlPlane = status?.control_plane;

  return {
    activeChange,
    availability,
    basePhase,
    desiredEnabled: desired?.enabled === true,
    phase,
    retryable:
      phase === "Failed" ||
      (!!controlPlane?.health_message && !controlPlane.ready),
    changeCapacityGiB:
      request?.operation?.kind === "update_cache"
        ? request.lmcache?.l1SizeGb || undefined
        : undefined,
    resultLabelKey,
    stale,
  };
}

export const cacheFailed = (summary?: ClusterCacheStatus) =>
  summary?.phase === "Failed";

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

function operationPhase(phase?: string) {
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

/** The activity sheet: the current problem or change, then past operations. */
export function zcacheActivity(
  summary?: ClusterCacheStatus,
  status?: ZCacheStatus,
) {
  const change = status?.change;
  const details =
    summary?.error_message || status?.observation_error || change
      ? {
          open: cacheFailed(summary) || !!status?.observation_error,
          errorMessage: summary?.error_message,
          observationError: status?.observation_error,
          change: change && {
            phaseKey: operationPhase(change.phase),
            message: change.message,
            operationId: change.operation_id || undefined,
          },
        }
      : undefined;
  const operations = (status?.operations ?? []).map((op) => ({
    id: op.id,
    labelKey: operationLabel(op.kind),
    phaseKey: operationPhase(op.phase),
    failed: op.phase === "Failed",
    createdAt: op.created_at || undefined,
    message: op.message,
    nodes: (op.nodes ?? []).map((node) => ({
      name: node.name,
      phaseKey: operationPhase(node.phase),
      reason: node.reason || undefined,
    })),
  }));
  return { details, operations };
}

// Use the product's neutral name in messages; keep resource identifiers intact.
export function cacheMessage(message: string | undefined, serviceName: string) {
  return message?.replace(/\bzcache(?=\s|:|$)/gi, serviceName);
}

/** Largest per-node L1 capacity the cache service accepts (int32 max). */
export const MAX_CACHE_CAPACITY_GIB = 2147483647;

/** A per-node capacity is a whole number of GiB within the service's range. */
export function isValidCacheCapacity(value: unknown) {
  const capacity = Number(value);
  return (
    Number.isInteger(capacity) &&
    capacity >= 1 &&
    capacity <= MAX_CACHE_CAPACITY_GIB
  );
}
