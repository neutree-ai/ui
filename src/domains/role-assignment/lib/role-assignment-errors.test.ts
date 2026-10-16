import { describe, expect, it } from "vitest";
import { roleAssignmentErrorMessage } from "./role-assignment-errors";

const t = (key: string) => key;

describe("roleAssignmentErrorMessage", () => {
  it.each([
    ["10041", "role_assignments.errors.workspaceUnsupported"],
    ["10280", "role_assignments.errors.orgUnitUnsupported"],
    ["10284", "role_assignments.errors.outsideScope"],
    ["10286", "role_assignments.errors.roleExceedsGrant"],
    ["10292", "role_assignments.errors.invalidSubjectKind"],
    ["10293", "role_assignments.errors.subjectMismatch"],
    ["10294", "role_assignments.errors.subjectNotFound"],
    ["10297", "role_assignments.errors.delegatedNoTeam"],
  ])("translates %s", (code, key) => {
    expect(roleAssignmentErrorMessage(t, { code })).toBe(key);
  });

  it("leaves other codes to the default notification", () => {
    expect(roleAssignmentErrorMessage(t, { code: "10287" })).toBeUndefined();
  });
});
