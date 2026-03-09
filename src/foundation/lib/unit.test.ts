import { describe, expect, it } from "vitest";
import { formatToDecimal, formatTokens } from "./unit";

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

describe("formatTokens", () => {
  it("returns null for null/undefined", () => {
    expect(formatTokens(null)).toBeNull();
    expect(formatTokens(undefined)).toBeNull();
  });

  it("shows raw number below 1K", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(999)).toBe("999");
  });

  it("formats thousands with K suffix", () => {
    expect(formatTokens(1_000)).toBe("1K");
    expect(formatTokens(1_230)).toBe("1.23K");
    expect(formatTokens(45_600)).toBe("45.6K");
  });

  it("formats millions with M suffix", () => {
    expect(formatTokens(1_000_000)).toBe("1M");
    expect(formatTokens(1_234_567)).toBe("1.23M");
  });

  it("formats billions with B suffix", () => {
    expect(formatTokens(1_000_000_000)).toBe("1B");
    expect(formatTokens(2_500_000_000)).toBe("2.5B");
  });
});
