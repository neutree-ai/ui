import { describe, expect, it } from "vitest";
import { mergeSchemaProperties } from "./merge-schema-properties";

describe("mergeSchemaProperties", () => {
  it("returns schema properties with no extras when value matches schema", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "integer" },
      },
    };
    const value = { name: "Alice", age: 30 };

    const result = mergeSchemaProperties(schema, value);

    expect(result.schemaProperties).toEqual(schema.properties);
    expect(result.extraProperties).toEqual({});
  });

  it("infers extra properties for keys not in schema", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
    };
    const value = { name: "Alice", extra: 42, nested: { a: true } };

    const result = mergeSchemaProperties(schema, value);

    expect(result.schemaProperties).toEqual(schema.properties);
    expect(result.extraProperties).toEqual({
      extra: { type: "integer" },
      nested: {
        type: "object",
        properties: {
          a: { type: "boolean" },
        },
      },
    });
  });

  it("returns empty extras when value is null", () => {
    const schema = {
      type: "object",
      properties: { name: { type: "string" } },
    };

    const result = mergeSchemaProperties(schema, null);

    expect(result.schemaProperties).toEqual(schema.properties);
    expect(result.extraProperties).toEqual({});
  });

  it("returns empty extras when value is not an object", () => {
    const schema = {
      type: "object",
      properties: { name: { type: "string" } },
    };

    const result = mergeSchemaProperties(schema, "not an object");

    expect(result.extraProperties).toEqual({});
  });

  it("returns empty extras when value is an array", () => {
    const schema = {
      type: "object",
      properties: { name: { type: "string" } },
    };

    const result = mergeSchemaProperties(schema, [1, 2, 3]);

    expect(result.extraProperties).toEqual({});
  });

  it("returns empty schema properties when schema has no properties", () => {
    const schema = { type: "object" };
    const value = { extra: "value" };

    const result = mergeSchemaProperties(schema, value);

    expect(result.schemaProperties).toEqual({});
    expect(result.extraProperties).toEqual({
      extra: { type: "string" },
    });
  });
});
