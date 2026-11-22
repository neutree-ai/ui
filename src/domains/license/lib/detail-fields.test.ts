import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import type { DetailField } from "@/foundation/scene/DetailFields";
import type { LicenseStatus } from "@/foundation/types/license";
import {
  licenseInfoFields,
  licenseUsageFields,
  remainingDays,
} from "./detail-fields";

const t = ((key: string) => key) as TFunction;
const DAY = 86_400;
const SIGNED = Date.UTC(2026, 0, 1, 12) / 1000;

const makeInfo = (
  overrides: Partial<LicenseStatus["info"]> = {},
): LicenseStatus["info"] => ({
  edition: "Enterprise",
  vendor: "Acme",
  sign_date: SIGNED,
  license_type: "Trial",
  period: 30 * DAY,
  max_gpus: 8,
  serial: "SN-1",
  ...overrides,
});

const fieldValue = <T>(fields: DetailField<T>[], key: string, record: T) => {
  const field = fields.find((candidate) => candidate.key === key);
  if (!field || !("value" in field)) throw new Error(`no value field ${key}`);
  return field.value(record, t);
};

describe("remainingDays", () => {
  it.each([
    { name: "counts a started day", elapsed: 0.5 * DAY, days: 30 },
    { name: "reaches zero at the end", elapsed: 30 * DAY, days: 0 },
    { name: "stays at zero once expired", elapsed: 45 * DAY, days: 0 },
  ])("$name", ({ elapsed, days }) => {
    expect(remainingDays(makeInfo(), (SIGNED + elapsed) * 1000)).toBe(days);
  });
});

describe("licenseInfoFields", () => {
  it("translates edition and license type by their lowercased value", () => {
    expect(fieldValue(licenseInfoFields, "edition", makeInfo())).toBe(
      "license.edition.enterprise",
    );
    expect(fieldValue(licenseInfoFields, "licenseType", makeInfo())).toBe(
      "license.licenseType.trial",
    );
  });

  it("shows a limited period in whole days and a limited GPU count as a number", () => {
    const info = makeInfo({ period: 30.9 * DAY });

    expect(fieldValue(licenseInfoFields, "period", info)).toBe(
      "30 license.fields.days",
    );
    expect(fieldValue(licenseInfoFields, "maxGpus", info)).toBe(8);
  });

  it("shows the unlimited sentinel as permanent or unlimited", () => {
    const info = makeInfo({ period: -1, max_gpus: -1 });

    expect(fieldValue(licenseInfoFields, "period", info)).toBe(
      "license.permanent",
    );
    expect(fieldValue(licenseInfoFields, "expirationDate", info)).toBe(
      "license.permanent",
    );
    expect(fieldValue(licenseInfoFields, "maxGpus", info)).toBe(
      "license.unlimited",
    );
  });

  it("shows the expiration date with the days left", () => {
    expect(
      fieldValue(
        licenseInfoFields,
        "expirationDate",
        makeInfo({ sign_date: SIGNED - 40 * DAY }),
      ),
    ).toBe("2025-12-22 (0 license.fields.days)");
  });
});

describe("licenseUsageFields", () => {
  it("lists only reported resource types, as used / limit", () => {
    const usage = { Workspace: { used: 2, limit: -1 } };
    const fields = licenseUsageFields(usage);

    expect(fields.map((field) => field.key)).toEqual(["Workspace"]);
    expect(fieldValue(fields, "Workspace", usage)).toBe(
      "2 / license.unlimited",
    );
  });

  it("reads a missing used count as zero", () => {
    const usage = { GPU: { limit: 4 } } as LicenseStatus["usage"] & object;

    expect(fieldValue(licenseUsageFields(usage), "GPU", usage)).toBe("0 / 4");
  });
});
