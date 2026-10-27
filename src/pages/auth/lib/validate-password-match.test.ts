import { describe, expect, it } from "vitest";
import { validatePasswordMatch } from "./validate-password-match";

describe("validatePasswordMatch", () => {
  it.each([
    ["abc123", "abc123", true],
    ["abc123", "abc456", false],
    ["abc123", "", false],
    ["", "", true],
  ])("%j vs %j -> %s", (password, confirm, matches) => {
    expect(validatePasswordMatch(password, confirm)).toBe(matches);
  });
});
