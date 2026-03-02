import { describe, expect, it } from "vitest";
import { checkTypeMatch, getActualType } from "./type-match";

describe("getActualType", () => {
  it('returns "null" for null', () => {
    expect(getActualType(null)).toBe("null");
  });

  it('returns "array" for arrays', () => {
    expect(getActualType([])).toBe("array");
    expect(getActualType([1, 2])).toBe("array");
  });

  it('returns "string" for strings', () => {
    expect(getActualType("hello")).toBe("string");
  });

  it('returns "number" for numbers', () => {
    expect(getActualType(42)).toBe("number");
    expect(getActualType(3.14)).toBe("number");
  });

  it('returns "boolean" for booleans', () => {
    expect(getActualType(true)).toBe("boolean");
  });

  it('returns "object" for plain objects', () => {
    expect(getActualType({})).toBe("object");
    expect(getActualType({ a: 1 })).toBe("object");
  });

  it('returns "undefined" for undefined', () => {
    expect(getActualType(undefined)).toBe("undefined");
  });
});

describe("checkTypeMatch", () => {
  it("matches same types", () => {
    expect(checkTypeMatch("hello", "string")).toBe(true);
    expect(checkTypeMatch(true, "boolean")).toBe(true);
    expect(checkTypeMatch(null, "null")).toBe(true);
    expect(checkTypeMatch([], "array")).toBe(true);
    expect(checkTypeMatch({}, "object")).toBe(true);
  });

  it("matches integer when value is an integer number", () => {
    expect(checkTypeMatch(42, "integer")).toBe(true);
  });

  it("does not match integer when value is a float", () => {
    expect(checkTypeMatch(3.14, "integer")).toBe(false);
  });

  it("matches number for any number value", () => {
    expect(checkTypeMatch(42, "number")).toBe(true);
    expect(checkTypeMatch(3.14, "number")).toBe(true);
  });

  it("does not match mismatched types", () => {
    expect(checkTypeMatch("hello", "number")).toBe(false);
    expect(checkTypeMatch(42, "string")).toBe(false);
    expect(checkTypeMatch(null, "string")).toBe(false);
  });
});
