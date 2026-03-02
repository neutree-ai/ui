import { describe, expect, it } from "vitest";
import { inferSchemaFromValue } from "./infer-schema";

describe("inferSchemaFromValue", () => {
  it("returns null type for null", () => {
    expect(inferSchemaFromValue(null)).toEqual({ type: "null" });
  });

  it("returns string type for string", () => {
    expect(inferSchemaFromValue("hello")).toEqual({ type: "string" });
  });

  it("returns integer type for integer number", () => {
    expect(inferSchemaFromValue(42)).toEqual({ type: "integer" });
  });

  it("returns number type for float", () => {
    expect(inferSchemaFromValue(3.14)).toEqual({ type: "number" });
  });

  it("returns boolean type for boolean", () => {
    expect(inferSchemaFromValue(true)).toEqual({ type: "boolean" });
    expect(inferSchemaFromValue(false)).toEqual({ type: "boolean" });
  });

  it("returns array type with inferred items for non-empty array", () => {
    expect(inferSchemaFromValue([1, 2, 3])).toEqual({
      type: "array",
      items: { type: "integer" },
    });
  });

  it("returns array type with string items for empty array", () => {
    expect(inferSchemaFromValue([])).toEqual({
      type: "array",
      items: { type: "string" },
    });
  });

  it("returns object type with recursive properties", () => {
    expect(inferSchemaFromValue({ name: "test", count: 5 })).toEqual({
      type: "object",
      properties: {
        name: { type: "string" },
        count: { type: "integer" },
      },
    });
  });

  it("handles nested objects recursively", () => {
    const value = {
      outer: {
        inner: "deep",
      },
    };
    expect(inferSchemaFromValue(value)).toEqual({
      type: "object",
      properties: {
        outer: {
          type: "object",
          properties: {
            inner: { type: "string" },
          },
        },
      },
    });
  });

  it("returns string type for undefined", () => {
    expect(inferSchemaFromValue(undefined)).toEqual({ type: "string" });
  });
});
