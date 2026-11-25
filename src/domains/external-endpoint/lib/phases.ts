import { phases } from "@/foundation/role/phases";

// Degraded is still serving, so it reads as a caution rather than a failure.
export const externalEndpointPhases = phases("status.phases.externalEndpoint", {
  Running: "positive",
  Failed: "serious",
  Degraded: "notice",
  Pending: "notice",
  Deleted: "neutral",
});

export const upstreamPhases = phases("status.phases.externalEndpointUpstream", {
  Ready: "positive",
  Failed: "serious",
});
