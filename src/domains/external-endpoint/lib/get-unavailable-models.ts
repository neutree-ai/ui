import type { UpstreamStatus } from "@/domains/external-endpoint/types";

/**
 * The models a failed upstream stopped serving. A degraded endpoint still
 * answers on its route, so callers need to tell the models that still work
 * from the ones the gateway no longer routes.
 */
export function getUnavailableModels(
  statuses: (UpstreamStatus | null)[],
): Set<string> {
  const ready = new Set(
    statuses
      .filter((status) => status?.phase === "Ready")
      .flatMap((status) => status?.models ?? []),
  );
  return new Set(
    statuses
      .filter((status) => status?.phase === "Failed")
      .flatMap((status) => status?.models ?? [])
      .filter((model) => !ready.has(model)),
  );
}
