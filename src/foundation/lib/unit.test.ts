import { describe, expect, it } from "vitest";
import { formatToDecimal } from "./unit";

describe("formatToDecimal", () => {
  it("formats a number", () => {
    expect(formatToDecimal(3.14)).toBe("3.1");
  });

  it("formats a numeric string", () => {
    expect(formatToDecimal("42")).toBe("42.0");
  });

  it("respects custom precision", () => {
    expect(formatToDecimal(1.23456, 3)).toBe("1.235");
  });

  it("returns null for null/undefined/empty", () => {
    expect(formatToDecimal(null)).toBeNull();
    expect(formatToDecimal(undefined)).toBeNull();
    expect(formatToDecimal("")).toBeNull();
  });

  it("returns null for non-numeric strings", () => {
    expect(formatToDecimal("abc")).toBeNull();
  });

  it("handles zero", () => {
    expect(formatToDecimal(0)).toBe("0.0");
    expect(formatToDecimal("0")).toBe("0.0");
  });
});
