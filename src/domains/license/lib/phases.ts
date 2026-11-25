import { phases } from "@/foundation/role/phases";

export const licensePhases = phases(
  "license.phase",
  {
    Active: "positive",
    Expired: "serious",
    Invalid: "serious",
    Pending: "notice",
  },
  { fallback: "neutral", lowercase: true },
);
