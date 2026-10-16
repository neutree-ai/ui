import { describe, expect, it } from "vitest";
import { groupPolicyErrorMessage } from "./group-policy-errors";

const t = (key: string) => key;

describe("groupPolicyErrorMessage", () => {
  it.each([
    ["10294", "group_policies.errors.groupNotFound"],
    ["10299", "group_policies.errors.workspaceNotAllowed"],
    ["10300", "group_policies.errors.invalidSubjectKind"],
    ["10301", "group_policies.errors.groupFixed"],
    ["10302", "group_policies.errors.invalidModels"],
    ["23505", "group_policies.errors.alreadyExists"],
  ])("maps %s", (code, key) => {
    expect(groupPolicyErrorMessage(t, { code })).toBe(key);
  });

  it("leaves other codes to the caller", () => {
    expect(groupPolicyErrorMessage(t, { code: "10041" })).toBeUndefined();
  });
});
