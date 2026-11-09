import { describe, expect, it } from "vitest";
import { GROUP_POLICY_ERROR_KEYS } from "./group-policy-errors";

describe("GROUP_POLICY_ERROR_KEYS", () => {
  it.each([
    ["10294", "group_policies.errors.groupNotFound"],
    ["10299", "group_policies.errors.workspaceNotAllowed"],
    ["10300", "group_policies.errors.invalidSubjectKind"],
    ["10301", "group_policies.errors.groupFixed"],
    ["10302", "group_policies.errors.invalidModels"],
    ["23505", "group_policies.errors.alreadyExists"],
  ])("maps %s", (code, key) => {
    expect(GROUP_POLICY_ERROR_KEYS[code]).toBe(key);
  });

  it("leaves other codes to the caller", () => {
    expect(GROUP_POLICY_ERROR_KEYS["10041"]).toBeUndefined();
  });
});
