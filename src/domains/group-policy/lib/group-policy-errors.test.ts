import { describe, expect, it } from "vitest";
import {
  GROUP_POLICY_ERROR_KEYS,
  GroupPolicyGoneError,
  groupPolicyErrorText,
} from "./group-policy-errors";

const t = (key: string) => key;
const apiError = (code: string, statusCode = 400) => ({
  statusCode,
  code,
});

describe("GROUP_POLICY_ERROR_KEYS", () => {
  it.each([
    ["10294", "group_policies.errors.groupNotFound"],
    ["10299", "group_policies.errors.workspaceNotAllowed"],
    ["10300", "group_policies.errors.invalidSubjectKind"],
    ["10301", "group_policies.errors.groupFixed"],
    ["10302", "group_policies.errors.invalidModels"],
    ["10328", "group_policies.errors.scopeMismatch"],
    ["10329", "group_policies.errors.notInScope"],
    ["23505", "group_policies.errors.alreadyExists"],
  ])("maps %s", (code, key) => {
    expect(GROUP_POLICY_ERROR_KEYS[code]).toBe(key);
  });

  it("leaves other codes to the caller", () => {
    expect(GROUP_POLICY_ERROR_KEYS["10041"]).toBeUndefined();
  });
});

describe("groupPolicyErrorText", () => {
  it.each([
    {
      error: new GroupPolicyGoneError(),
      deniedKey: undefined,
      text: "group_policies.errors.gone",
    },
    { error: apiError("42501", 403), deniedKey: "denied", text: "denied" },
    {
      error: apiError("10329"),
      deniedKey: "denied",
      text: "group_policies.errors.notInScope",
    },
  ])("$text", ({ error, deniedKey, text }) => {
    expect(groupPolicyErrorText(t, error, deniedKey)).toBe(text);
  });
});
