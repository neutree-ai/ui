import {
  fixtureMetadata,
  unixSeconds,
} from "@/foundation/testing/visual-fixtures";
import type { License, LicenseStatus } from "@/foundation/types/license";

const DAY = 24 * 60 * 60;

function makeLicense(status: LicenseStatus | null): License {
  return {
    id: 1,
    api_version: "v1",
    kind: "License",
    metadata: fixtureMetadata("license"),
    spec: { code: "" },
    status,
  };
}

/** An active, time-limited license with usage reported. */
export const activeLicense = makeLicense({
  phase: "Active",
  last_transition_time: "2026-05-01T00:00:00Z",
  info: {
    edition: "Enterprise",
    vendor: "Example Corp",
    sign_date: unixSeconds("2026-01-15T00:00:00Z"),
    license_type: "Subscription",
    period: 365 * DAY,
    max_gpus: 1280,
    serial: "EX-2026-0001-ABCD-EFGH-IJKL",
  },
  usage: {
    GPU: { used: 32, limit: 1280 },
    Workspace: { used: 3, limit: 10 },
  },
});

/** A permanent license with no limits, and no usage block. */
export const unlimitedLicense = makeLicense({
  phase: "Active",
  last_transition_time: "2026-05-01T00:00:00Z",
  info: {
    edition: "Enterprise",
    vendor: "Example Corp",
    sign_date: unixSeconds("2025-12-31T23:30:00Z"),
    license_type: "Perpetual",
    period: -1,
    max_gpus: -1,
    serial: "EX-2025-9999-ZZZZ",
  },
});

/** An expired license that carries the server's error message. */
export const expiredLicense = makeLicense({
  phase: "Expired",
  last_transition_time: "2026-05-30T00:00:00Z",
  error_message: "license expired on 2026-05-29",
  info: {
    edition: "Enterprise",
    vendor: "Example Corp",
    sign_date: unixSeconds("2025-05-29T00:00:00Z"),
    license_type: "Trial",
    period: 365 * DAY,
    max_gpus: 1234567,
    serial: "EX-2025-TRIAL-0042",
  },
  usage: { GPU: { used: 0, limit: 1234567 } },
});
