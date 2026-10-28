import { describe, expect, it } from "vitest";
import { checkTypeMatch, getActualType } from "./type-match";

describe("getActualType", () => {
  it.each([
    [null, "null"],
    [[1, 2], "array"],
    ["hello", "string"],
    [3.14, "number"],
    [true, "boolean"],
    [{ a: 1 }, "object"],
    [undefined, "undefined"],
  ])("%j -> %s", (value, type) => {
    expect(getActualType(value)).toBe(type);
  });
});

describe("checkTypeMatch", () => {
  it.each([
    ["hello", "string", true],
    [null, "null", true],
    [[], "array", true],
    [{}, "object", true],
    [42, "integer", true],
    [3.14, "integer", false],
    [3.14, "number", true],
    ["hello", "number", false],
    [null, "string", false],
  ])("%j against %s -> %s", (value, type, match) => {
    expect(checkTypeMatch(value, type)).toBe(match);
  });
});
