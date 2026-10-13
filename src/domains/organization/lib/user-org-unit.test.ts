import { describe, expect, it } from "vitest";
import { isLocalProfile, orgUnitAssignmentMode } from "./user-org-unit";

const local = { metadata: { labels: {} } };
const external = {
  metadata: { labels: { "neutree.ai/identity-source": "ldap" } },
};

describe("isLocalProfile", () => {
  it("tells local accounts by the missing identity-source label", () => {
    expect(isLocalProfile(local)).toBe(true);
    expect(isLocalProfile({ metadata: { labels: null } })).toBe(true);
    expect(isLocalProfile(external)).toBe(false);
  });
});

describe("orgUnitAssignmentMode", () => {
  it("creates for a local user without a department", () => {
    expect(orgUnitAssignmentMode(local, null)).toBe("create");
  });

  it("updates a hand assignment", () => {
    expect(orgUnitAssignmentMode(local, { identity_source: null })).toBe(
      "update",
    );
  });

  it("leaves synced departments and external users to sync", () => {
    expect(
      orgUnitAssignmentMode(local, { identity_source: "corp" }),
    ).toBeNull();
    expect(orgUnitAssignmentMode(external, null)).toBeNull();
    expect(
      orgUnitAssignmentMode(external, { identity_source: "corp" }),
    ).toBeNull();
  });
});
