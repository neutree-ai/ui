import { describe, expect, it } from "vitest";
import {
  buildValueSchemaRows,
  formatDefaultValue,
  splitDescriptionJson,
} from "./value-schema-rows";

describe("buildValueSchemaRows", () => {
  it("flattens a flat schema in declaration order", () => {
    const { rows, allowsAdditional } = buildValueSchemaRows({
      type: "object",
      required: ["command"],
      properties: {
        command: {
          type: "string",
          title: "Command",
          description: "Starts the workload.",
        },
        health_path: { type: "string", default: "/health" },
      },
    });

    expect(allowsAdditional).toBe(false);
    expect(rows.map((row) => row.path)).toEqual(["command", "health_path"]);
    expect(rows[0]).toMatchObject({
      name: "command",
      title: "Command",
      required: true,
      depth: 0,
      hasChildren: false,
    });
    expect(rows[1]).toMatchObject({
      title: null,
      required: false,
      hasDefault: true,
      defaultValue: "/health",
    });
  });

  it("keeps nested fields as children addressed by path", () => {
    const { rows } = buildValueSchemaRows({
      type: "object",
      properties: {
        tensor_parallel_size: { type: "integer", default: 1 },
        rope_scaling: {
          type: "object",
          description: "RoPE scaling configuration",
          properties: {
            factor: { type: "number" },
            type: { type: "string", enum: ["linear", "dynamic"] },
          },
        },
      },
    });

    expect(rows.map((row) => row.path)).toEqual([
      "tensor_parallel_size",
      "rope_scaling",
      "rope_scaling.factor",
      "rope_scaling.type",
    ]);
    expect(rows[1]).toMatchObject({ hasChildren: true, childCount: 2 });
    expect(rows[2]).toMatchObject({ parentId: "rope_scaling", depth: 1 });
    expect(rows[3].enumValues).toEqual(["linear", "dynamic"]);
  });

  it("records the parent name so deep rows can stay attached to it", () => {
    const { rows } = buildValueSchemaRows({
      type: "object",
      properties: {
        serving: {
          type: "object",
          properties: {
            placement: {
              type: "object",
              properties: { weight: { type: "integer" } },
            },
          },
        },
      },
    });

    expect(rows.map((row) => row.parentName)).toEqual([
      null,
      "serving",
      "placement",
    ]);
    // An array of objects addresses its members, but the parent is still the
    // array field itself.
    const arrayRows = buildValueSchemaRows({
      type: "object",
      properties: {
        volumes: {
          type: "array",
          items: { type: "object", properties: { name: { type: "string" } } },
        },
      },
    }).rows;
    expect(arrayRows[1]).toMatchObject({
      path: "volumes[].name",
      parentId: "volumes",
      parentName: "volumes",
    });
  });

  it("reads children of an array of objects through the items schema", () => {
    const { rows } = buildValueSchemaRows({
      type: "object",
      properties: {
        extra_volumes: {
          type: "array",
          items: {
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string" },
              mount_path: { type: "string" },
            },
          },
        },
      },
    });

    expect(rows.map((row) => row.path)).toEqual([
      "extra_volumes",
      "extra_volumes[].name",
      "extra_volumes[].mount_path",
    ]);
    expect(rows[0]).toMatchObject({
      types: ["array"],
      itemType: "object",
      childCount: 2,
    });
    expect(rows[1].required).toBe(true);
  });

  it("splits union types and keeps the array item type", () => {
    const { rows } = buildValueSchemaRows({
      type: "object",
      properties: {
        served_model_name: {
          type: ["string", "array"],
          items: { type: "string" },
        },
      },
    });

    expect(rows[0].types).toEqual(["string", "array"]);
    expect(rows[0].itemType).toBe("string");
  });

  it("reports a schema that declares nothing but accepts extras", () => {
    const { rows, allowsAdditional } = buildValueSchemaRows({
      type: "object",
      additionalProperties: true,
    });

    expect(rows).toEqual([]);
    expect(allowsAdditional).toBe(true);
  });

  it("survives a schema that is not an object", () => {
    expect(buildValueSchemaRows(null).rows).toEqual([]);
    expect(buildValueSchemaRows("nonsense").rows).toEqual([]);
  });
});

describe("formatDefaultValue", () => {
  it("keeps strings quoted so an empty default is visible", () => {
    expect(formatDefaultValue("auto")).toBe('"auto"');
    expect(formatDefaultValue("")).toBe('""');
  });

  it("serializes structured defaults", () => {
    expect(formatDefaultValue([1, 2])).toBe("[1,2]");
    expect(formatDefaultValue({ a: 1 })).toBe('{"a":1}');
    expect(formatDefaultValue(false)).toBe("false");
    expect(formatDefaultValue(0)).toBe("0");
  });

  it("renders nothing for an absent default", () => {
    expect(formatDefaultValue(undefined)).toBe("");
  });
});

describe("splitDescriptionJson", () => {
  it("pretty-prints an embedded JSON example and drops its quoting", () => {
    const segments = splitDescriptionJson(
      `JSON config. Example: '{"url": "localhost:8001", "source": true}'`,
    );

    expect(segments[0]).toEqual({
      kind: "text",
      value: "JSON config. Example:",
    });
    expect(segments[1].kind).toBe("json");
    expect(segments[1].value).toContain('"url": "localhost:8001"');
    expect(segments).toHaveLength(2);
  });

  it("leaves prose that only looks like JSON alone", () => {
    const segments = splitDescriptionJson(
      "Represent tokens as token_id:{id} strings",
    );

    expect(segments).toHaveLength(1);
    expect(segments[0].kind).toBe("text");
    expect(segments[0].value).toBe("Represent tokens as token_id:{id} strings");
  });

  it("returns plain prose unchanged", () => {
    const segments = splitDescriptionJson("Context size for the model.");

    expect(segments).toEqual([
      { kind: "text", value: "Context size for the model." },
    ]);
  });
});
