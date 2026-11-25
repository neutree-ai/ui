import type { NodeResourceStatus } from "@/foundation/types/resource-types";
import type { ClusterCacheStatus, ZCacheSpec, ZCacheStatus } from "../types";

export type ZCacheCandidateReason =
  | {
      kind: "translation";
      key:
        | "clusters.zcache.notReady"
        | "clusters.zcache.kubernetesControlPlane";
    }
  | { kind: "message"; value: string };

export type ZCacheCandidate = {
  name: string;
  selectable: boolean;
  reason?: ZCacheCandidateReason;
};

const CONTROL_PLANE_REASON =
  "control-plane nodes are not used for the ZCache runtime by default";

function apiCandidate(
  candidate: NonNullable<ZCacheStatus["candidates"]>[number],
): ZCacheCandidate {
  if (!candidate.reason) {
    return { name: candidate.name, selectable: candidate.selectable };
  }
  return {
    name: candidate.name,
    selectable: candidate.selectable,
    reason:
      candidate.reason === CONTROL_PLANE_REASON
        ? {
            kind: "translation",
            key: "clusters.zcache.kubernetesControlPlane",
          }
        : { kind: "message", value: candidate.reason },
  };
}

/** Resolve the nodes that can be selected before the cache service reports candidates. */
export function resolveZCacheCandidates({
  candidates,
  nodeResources,
}: {
  candidates?: ZCacheStatus["candidates"];
  nodeResources?: Record<string, NodeResourceStatus> | null;
}): ZCacheCandidate[] {
  if (candidates?.length) return candidates.map(apiCandidate);
  if (!nodeResources) return [];

  return Object.entries(nodeResources)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, resource]) => {
      if (resource.ready === false) {
        return {
          name,
          selectable: false,
          reason: { kind: "translation", key: "clusters.zcache.notReady" },
        };
      }
      if (resource.control_plane === true) {
        return {
          name,
          selectable: false,
          reason: {
            kind: "translation",
            key: "clusters.zcache.kubernetesControlPlane",
          },
        };
      }
      return { name, selectable: true };
    });
}

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

  return {
    activeChange: activeCacheChange(status),
    availability,
    basePhase,
    desiredEnabled: desired?.enabled === true,
    phase,
    resultLabelKey,
    stale,
  };
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
