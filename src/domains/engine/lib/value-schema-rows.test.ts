import { describe, expect, it } from "vitest";
import {
  buildValueSchemaRows,
  filterValueSchemaRows,
  formatDefaultValue,
  splitDescriptionJson,
  valueSchemaTypeOptions,
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

describe("value schema filters", () => {
  const rows = buildValueSchemaRows({
    type: "object",
    required: ["command"],
    properties: {
      command: { type: "string", description: "Starts the workload." },
      gpu_memory: { type: "integer" },
      rope_scaling: {
        type: "object",
        description: "RoPE scaling configuration",
        required: ["factor"],
        properties: {
          factor: { type: "number" },
          type: { type: "string", enum: ["linear", "dynamic"] },
        },
      },
      served_model_name: { type: "array", items: { type: "string" } },
    },
  }).rows;

  it("offers the labels the type cell shows, alphabetically", () => {
    expect(valueSchemaTypeOptions(rows)).toEqual([
      "array<string>",
      "integer",
      "number",
      "object",
      "string",
    ]);
  });

  it("returns null when nothing is filtered, so collapse state still applies", () => {
    expect(
      filterValueSchemaRows(rows, {
        query: "  ",
        type: "",
        onlyRequired: false,
      }),
    ).toBeNull();
  });

  it("keeps the ancestors of a match so a nested row still reads as a path", () => {
    const visible = filterValueSchemaRows(rows, {
      query: "factor",
      type: "",
      onlyRequired: false,
    });

    expect(visible?.map((row) => row.path)).toEqual([
      "rope_scaling",
      "rope_scaling.factor",
    ]);
  });

  it("filters by the array item type the type column renders", () => {
    const visible = filterValueSchemaRows(rows, {
      query: "",
      type: "array<string>",
      onlyRequired: false,
    });

    expect(visible?.map((row) => row.path)).toEqual(["served_model_name"]);
  });

  it("filters to required parameters and keeps their ancestors", () => {
    const visible = filterValueSchemaRows(rows, {
      query: "",
      type: "",
      onlyRequired: true,
    });

    expect(visible?.map((row) => row.path)).toEqual([
      "command",
      "rope_scaling",
      "rope_scaling.factor",
    ]);
  });

  it("applies every active part of the filter together", () => {
    // `rope_scaling.type` is a string and matches the text, so it shows with
    // its ancestor…
    expect(
      filterValueSchemaRows(rows, {
        query: "scaling",
        type: "string",
        onlyRequired: false,
      })?.map((row) => row.path),
    ).toEqual(["rope_scaling", "rope_scaling.type"]);

    // …but it is not required, so adding that part drops the match. The
    // ancestor is context for a match, never a match of its own.
    expect(
      filterValueSchemaRows(rows, {
        query: "scaling",
        type: "string",
        onlyRequired: true,
      }),
    ).toEqual([]);
  });
});
