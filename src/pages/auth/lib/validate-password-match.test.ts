import { describe, expect, it } from "vitest";
import { validatePasswordMatch } from "./validate-password-match";

describe("validatePasswordMatch", () => {
  it("returns true when passwords match", () => {
    expect(validatePasswordMatch("abc123", "abc123")).toBe(true);
  });

  it("returns false when passwords differ", () => {
    expect(validatePasswordMatch("abc123", "abc456")).toBe(false);
  });

  it("returns false when one is empty", () => {
    expect(validatePasswordMatch("abc123", "")).toBe(false);
  });

  it("returns true when both are empty", () => {
    expect(validatePasswordMatch("", "")).toBe(true);
  });
});
