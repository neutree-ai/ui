import { phases } from "@/foundation/role/phases";

export const clusterPhases = phases("status.phases.cluster", {
  Running: "positive",
  Failed: "serious",
  Pending: "notice",
  Paused: "notice",
  Initializing: "notice",
  Updating: "notice",
  Upgrading: "outstanding",
  Deleting: "neutral",
  Deleted: "neutral",
});
