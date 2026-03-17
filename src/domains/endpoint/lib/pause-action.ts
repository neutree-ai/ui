import type { Endpoint } from "@/domains/endpoint/types";

export const LAST_REPLICA_LABEL = "neutree.ai/last_replicas";

/**
 * Parse a stored replica count value. Returns undefined if the value
 * is not a finite positive number.
 */
export function parseReplicaCount(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

type PauseState = {
  isPaused: boolean;
  replicaCount: number;
  resumeReplicaCount: number;
};

/**
 * Derive the pause/resume state from an endpoint.
 */
export function derivePauseState(endpoint: Endpoint): PauseState {
  const rawReplicaCount = endpoint.spec.replicas?.num;
  const replicaCount =
    typeof rawReplicaCount === "number" ? rawReplicaCount : 1;
  const labels = (endpoint.metadata.labels ?? {}) as Record<string, unknown>;
  const storedReplicaCount = parseReplicaCount(labels[LAST_REPLICA_LABEL]);
  const isPaused = replicaCount === 0;
  const resumeReplicaCount =
    storedReplicaCount ?? (replicaCount > 0 ? replicaCount : 1);

  return { isPaused, replicaCount, resumeReplicaCount };
}

type TogglePayload = {
  nextReplicaCount: number;
  nextLabels: Record<string, unknown> | null;
};

/**
 * Compute the mutation payload for toggling pause/resume.
 */
export function computeTogglePayload(endpoint: Endpoint): TogglePayload {
  const { isPaused, replicaCount, resumeReplicaCount } =
    derivePauseState(endpoint);
  const labels = (endpoint.metadata.labels ?? {}) as Record<string, unknown>;

  const nextReplicaCount = isPaused
    ? resumeReplicaCount > 0
      ? resumeReplicaCount
      : 1
    : 0;

  const nextLabels = { ...labels };
  if (isPaused) {
    delete nextLabels[LAST_REPLICA_LABEL];
  } else {
    const previousReplicas =
      replicaCount > 0
        ? replicaCount
        : (parseReplicaCount(labels[LAST_REPLICA_LABEL]) ?? 1);
    nextLabels[LAST_REPLICA_LABEL] = String(previousReplicas);
  }

  return {
    nextReplicaCount,
    nextLabels: Object.keys(nextLabels).length > 0 ? nextLabels : null,
  };
}
