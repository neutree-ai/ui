import { endpointZCacheOptions } from "@/domains/endpoint/lib/zcache";
import type { EndpointClusterRef } from "@/domains/endpoint/types";

type EndpointCacheManagerStatus =
  | {
      kind: "loading";
    }
  | {
      kind: "not-configured";
    }
  | {
      kind: "ready";
      l1CapacityGiB: number | null;
    }
  | {
      kind: "pending" | "unavailable";
      phase: string;
      errorMessage: string | null;
      l1CapacityGiB: number | null;
    };

const positiveNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;

const failureMessage = (cluster: EndpointClusterRef): string | null => {
  const status = cluster.status?.cache;
  if (!status) return null;

  const failedCondition = status.conditions?.find(
    (condition) =>
      condition.status !== "True" && (condition.message || condition.reason),
  );

  return (
    status.error_message?.trim() ||
    failedCondition?.message?.trim() ||
    failedCondition?.reason?.trim() ||
    null
  );
};

/**
 * Reads the cluster-owned cache state without inventing a second health model.
 * `phase` is the backend's mutually exclusive summary; `conditions` provide the
 * detail shown only when the provider is not ready.
 */
export function readEndpointCacheManagerStatus(
  cluster: EndpointClusterRef | undefined,
  loading: boolean,
): EndpointCacheManagerStatus {
  const options = endpointZCacheOptions(cluster);
  const status = cluster?.status?.cache;

  if (!cluster || !options?.enabled || !status) {
    return loading ? { kind: "loading" } : { kind: "not-configured" };
  }

  const l1CapacityGiB =
    positiveNumber(status.details?.current?.l1_size_gib) ??
    positiveNumber(options.l1_size_gib);
  const phase = status.phase?.trim() || "Unknown";
  const errorMessage = failureMessage(cluster);

  if (phase === "Ready" && !errorMessage) {
    return { kind: "ready", l1CapacityGiB };
  }

  return {
    kind: phase === "Reconciling" && !errorMessage ? "pending" : "unavailable",
    phase,
    errorMessage,
    l1CapacityGiB,
  };
}
