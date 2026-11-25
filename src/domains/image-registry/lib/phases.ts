import { phases } from "@/foundation/role/phases";

export const imageRegistryPhases = phases("status.phases.registry", {
  Connected: "positive",
  Failed: "serious",
  Pending: "notice",
  Deleted: "neutral",
});
