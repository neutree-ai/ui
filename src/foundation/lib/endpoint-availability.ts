/**
 * Whether an endpoint (internal or external) is on its way out.
 *
 * An endpoint is deleted in two steps: the row is stamped with a
 * `deletion_timestamp` at once, the controller reports `Deleting` while it
 * tears the endpoint down and `Deleted` when it is gone. Any of these means the
 * endpoint should no longer be offered as a model to invoke.
 *
 * The parameter is structural so that a caller holding only the fields it
 * selected satisfies it.
 */
export type EndpointLifecycle = {
  metadata?: { deletion_timestamp?: string | null } | null;
  status?: { phase?: string | null } | null;
};

/** Whether a reported phase means the endpoint is being or has been deleted. */
export const isEndpointPhaseWithdrawn = (phase: string | null | undefined) =>
  phase === "Deleting" || phase === "Deleted";

export const isEndpointWithdrawn = (endpoint: EndpointLifecycle) =>
  Boolean(endpoint.metadata?.deletion_timestamp) ||
  isEndpointPhaseWithdrawn(endpoint.status?.phase);
