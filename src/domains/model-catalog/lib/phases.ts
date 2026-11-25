import { phases } from "@/foundation/role/phases";

export const modelCatalogPhases = phases("status.phases.catalog", {
  Ready: "positive",
  Failed: "serious",
  Pending: "notice",
  Deleted: "neutral",
});
