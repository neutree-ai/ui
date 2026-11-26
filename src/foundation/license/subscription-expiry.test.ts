import { describe, expect, it } from "vitest";
import type { LicenseStatus } from "@/foundation/types/license";
import { isExpiredSubscription } from "./subscription-expiry";

describe("isExpiredSubscription", () => {
  it.each([
    ["Expired", "SUBSCRIPTION", true],
    ["Active", "SUBSCRIPTION", false],
    ["Invalid", "SUBSCRIPTION", false],
    ["Pending", "SUBSCRIPTION", false],
    ["Expired", "TRIAL", false],
    ["Active", "PERPETUAL", false],
  ] as const)("%s %s -> %s", (phase, license_type, expected) => {
    const status: LicenseStatus = {
      phase,
      last_transition_time: "",
      info: {
        license_type,
        edition: "ENTERPRISE",
        vendor: "ARCFRA",
        sign_date: 0,
        period: 1,
        max_gpus: 1,
        serial: "test",
      },
    };
    expect(isExpiredSubscription(status)).toBe(expected);
  });

  it.each([null, undefined])(
    "does not warn without a license: %s",
    (status) => {
      expect(isExpiredSubscription(status)).toBe(false);
    },
  );
});
