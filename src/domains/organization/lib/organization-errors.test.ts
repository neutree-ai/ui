import { describe, expect, it } from "vitest";
import { ORGANIZATION_ERROR_KEYS } from "./organization-errors";

describe("ORGANIZATION_ERROR_KEYS", () => {
  it.each([
    ...Array.from({ length: 9 }, (_, i) => 10270 + i),
    ...Array.from({ length: 4 }, (_, i) => 10288 + i),
  ])("maps the organization code %s", (code) => {
    expect(ORGANIZATION_ERROR_KEYS[String(code)]).toMatch(
      /^organization\.errors\./,
    );
  });

  it.each([
    ["10287", "organization.errors.globalAssignerOnly"],
    ["10295", "organization.errors.teamHasRoleAssignments"],
    ["10296", "organization.errors.memberGrantExceeds"],
  ])("maps %s", (code, key) => {
    expect(ORGANIZATION_ERROR_KEYS[code]).toBe(key);
  });

  it("leaves other codes to the caller", () => {
    expect(ORGANIZATION_ERROR_KEYS["10250"]).toBeUndefined();
  });
});
