import { describe, expect, it } from "vitest";
import { mapOperator } from "./map-operator";

describe("mapOperator", () => {
  it.each([
    ["ne", "neq"],
    ["nin", "not.in"],
    ["contains", "ilike"],
    ["ncontains", "not.ilike"],
    ["containss", "like"],
    ["ncontainss", "not.like"],
    ["null", "is"],
    ["nnull", "not.is"],
    ["ina", "cs"],
    ["nina", "not.cs"],
  ] as const)("maps %s → %s", (input, expected) => {
    expect(mapOperator(input)).toBe(expected);
  });

  it("passes through unmapped operators", () => {
    expect(mapOperator("eq")).toBe("eq");
    expect(mapOperator("gt")).toBe("gt");
    expect(mapOperator("lt")).toBe("lt");
    expect(mapOperator("in")).toBe("in");
  });

  it("throws on unsupported operators", () => {
    expect(() => mapOperator("between")).toThrow("not supported");
    expect(() => mapOperator("nbetween")).toThrow("not supported");
  });
});
