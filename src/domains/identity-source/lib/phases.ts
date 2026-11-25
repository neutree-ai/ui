import { phases } from "@/foundation/role/phases";

export const identitySourcePhases = phases("identity_sources.phases", {
  Connected: "positive",
  Failed: "serious",
  Pending: "notice",
  Deleted: "neutral",
});
