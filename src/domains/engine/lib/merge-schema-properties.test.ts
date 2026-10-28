import { describe, expect, it } from "vitest";
import { mergeSchemaProperties } from "./merge-schema-properties";

const schema = { type: "object", properties: { name: { type: "string" } } };

describe("mergeSchemaProperties", () => {
  it("keeps the schema properties and infers the keys it does not declare", () => {
    const result = mergeSchemaProperties(schema, {
      name: "Alice",
      extra: 42,
      nested: { a: true },
    });

    expect(result.schemaProperties).toEqual(schema.properties);
    expect(result.extraProperties).toEqual({
      extra: { type: "integer" },
      nested: { type: "object", properties: { a: { type: "boolean" } } },
    });
  });

  it.each([
    ["matches the schema", { name: "Alice" }],
    ["is null", null],
    ["is not an object", "not an object"],
    ["is an array", [1, 2, 3]],
  ])("reports no extras when the value %s", (_case, value) => {
    expect(mergeSchemaProperties(schema, value).extraProperties).toEqual({});
  });

  it("treats every key as extra when the schema declares no properties", () => {
    const result = mergeSchemaProperties({ type: "object" }, { extra: "v" });

    expect(result.schemaProperties).toEqual({});
    expect(result.extraProperties).toEqual({ extra: { type: "string" } });
  });
});
