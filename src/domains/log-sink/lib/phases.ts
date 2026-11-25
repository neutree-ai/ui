import { phases } from "@/foundation/role/phases";

export const logSinkPhases = phases("status.phases.logSink", {
  Running: "positive",
  Failed: "serious",
  Degraded: "notice",
  Pending: "notice",
  Disabled: "neutral",
  Deleted: "neutral",
});
