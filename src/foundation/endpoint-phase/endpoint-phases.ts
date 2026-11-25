import { phases } from "@/foundation/role/phases";

export const endpointPhases = phases("status.phases.endpoint", {
  Running: "positive",
  Failed: "serious",
  Pending: "notice",
  // External endpoints only: serving, but some upstream is unavailable
  Degraded: "notice",
  Deploying: "outstanding",
  ModelDownloading: "outstanding",
  Deleting: "notice",
  Paused: "notice",
  Deleted: "neutral",
});
