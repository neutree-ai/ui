import { describe, expect, it } from "vitest";
import { inferSchemaFromValue } from "./infer-schema";

describe("inferSchemaFromValue", () => {
  it.each([
    [null, { type: "null" }],
    ["hello", { type: "string" }],
    [42, { type: "integer" }],
    [3.14, { type: "number" }],
    [false, { type: "boolean" }],
    [undefined, { type: "string" }],
    [[1, 2, 3], { type: "array", items: { type: "integer" } }],
    [[], { type: "array", items: { type: "string" } }],
  ])("%j -> %j", (value, schema) => {
    expect(inferSchemaFromValue(value)).toEqual(schema);
  });

  it("infers object properties recursively", () => {
    expect(
      inferSchemaFromValue({ count: 5, outer: { inner: "deep" } }),
    ).toEqual({
      type: "object",
      properties: {
        count: { type: "integer" },
        outer: { type: "object", properties: { inner: { type: "string" } } },
      },
    });
  });
});
