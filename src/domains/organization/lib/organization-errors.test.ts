import { describe, expect, it } from "vitest";
import {
  ORGANIZATION_ERROR_KEYS,
  organizationErrorMessage,
} from "./organization-errors";

const t = (key: string, options?: Record<string, unknown>) =>
  options?.hint ? `${key}|${options.hint}` : key;

describe("organizationErrorMessage", () => {
  it("maps every organization code 10270-10278", () => {
    for (let code = 10270; code <= 10278; code++) {
      expect(ORGANIZATION_ERROR_KEYS[String(code)]).toMatch(
        /^organization\.errors\./,
      );
    }
  });

  it("translates a database error and passes the hint on", () => {
    expect(
      organizationErrorMessage(t, {
        code: "10275",
        message: "spec.parent does not name an OrgUnit",
        hint: "Sync the parent first, or leave spec.parent empty for a root",
      }),
    ).toBe(
      "organization.errors.invalidParent|Sync the parent first, or leave spec.parent empty for a root",
    );
  });

  it("leaves other errors to the caller", () => {
    expect(organizationErrorMessage(t, { code: "10250" })).toBeUndefined();
    expect(organizationErrorMessage(t, new Error("x"))).toBeUndefined();
  });
});
