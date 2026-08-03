import type { ExternalEndpointStatus } from "@/domains/external-endpoint/types";

/**
 * Whether the endpoint is reachable on its route. Degraded means at least one
 * upstream was excluded from the gateway configuration, but the remaining ones
 * are still serving — so it is not a failure state for anything that asks
 * "can clients call this?".
 */
export function isServingPhase(
  phase: ExternalEndpointStatus["phase"] | null | undefined,
): boolean {
  return phase === "Running" || phase === "Degraded";
}
