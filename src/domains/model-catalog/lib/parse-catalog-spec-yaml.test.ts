import { describe, expect, it } from "vitest";
import { parseCatalogSpecYaml } from "./parse-catalog-spec-yaml";

const record = { name: "qwen3-6-27b", workspace: "default" };

const bareSpec = `engine:
  engine: vllm
  version: v0.24.0
variants:
  bf16:
    model:
      name: Qwen/Qwen3.6-27B
`;

const fullDocument = `apiVersion: v1
kind: ModelCatalog
metadata:
  name: qwen3-6-27b
  workspace: default
spec:
  engine:
    engine: vllm
    version: v0.24.0
  variants:
    bf16:
      model:
        name: Qwen/Qwen3.6-27B
`;

const parsedSpec = {
  engine: { engine: "vllm", version: "v0.24.0" },
  variants: { bf16: { model: { name: "Qwen/Qwen3.6-27B" } } },
};

describe("parseCatalogSpecYaml", () => {
  it("parses a bare spec", () => {
    const result = parseCatalogSpecYaml(bareSpec, record);

    expect(result).toEqual({ ok: true, spec: parsedSpec });
  });

  // NEU-611: pasting the whole document used to store the envelope as the spec,
  // leaving the record with no engine and blanking the list page.
  it("unwraps a full ModelCatalog document to its spec", () => {
    const result = parseCatalogSpecYaml(fullDocument, record);

    expect(result).toEqual({
      ok: true,
      spec: parsedSpec,
      metadata: { labels: {}, annotations: {} },
    });
  });

  it("carries back the labels and annotations a document declares", () => {
    const result = parseCatalogSpecYaml(
      fullDocument.replace(
        "  workspace: default",
        `  workspace: default
  labels:
    tier: gold
  annotations:
    recipe.vllm.ai/hardware-verified: "L20"`,
      ),
      record,
    );

    expect(result).toEqual({
      ok: true,
      spec: parsedSpec,
      metadata: {
        labels: { tier: "gold" },
        annotations: { "recipe.vllm.ai/hardware-verified": "L20" },
      },
    });
  });

  it("accepts a document whose metadata omits the workspace", () => {
    const result = parseCatalogSpecYaml(
      `kind: ModelCatalog\nmetadata:\n  name: qwen3-6-27b\nspec:\n  engine:\n    engine: vllm\n`,
      record,
    );

    expect(result).toEqual({
      ok: true,
      spec: { engine: { engine: "vllm" } },
      metadata: { labels: {}, annotations: {} },
    });
  });

  it("keeps a bare spec that happens to have a nested spec key", () => {
    const result = parseCatalogSpecYaml(
      `spec:\n  nested: true\nengine:\n  engine: vllm\n`,
      record,
    );

    // No envelope keys alongside it, so this is the spec itself — and with no
    // document to state them, the record's metadata is left alone.
    expect(result).toEqual({
      ok: true,
      spec: { spec: { nested: true }, engine: { engine: "vllm" } },
    });
  });

  // An envelope whose spec was deleted or mangled must not be stored as the
  // spec — that would reproduce the NEU-611 corruption the parser guards.
  it.each([
    ["a missing spec", `kind: ModelCatalog\nmetadata:\n  name: ${"neu"}\n`],
    ["a null spec", `apiVersion: v1\nkind: ModelCatalog\nspec:\n`],
    ["a non-mapping spec", `kind: ModelCatalog\nspec: not-a-mapping\n`],
    ["only metadata", `metadata:\n  name: qwen3-6-27b\n`],
  ])("rejects an envelope with %s", (_label, text) => {
    expect(parseCatalogSpecYaml(text, record)).toEqual({
      ok: false,
      error: { type: "missingSpec" },
    });
  });

  it("rejects a document for a different catalog", () => {
    const result = parseCatalogSpecYaml(
      fullDocument.replace("name: qwen3-6-27b", "name: llama-3-8b"),
      record,
    );

    expect(result).toEqual({
      ok: false,
      error: {
        type: "nameMismatch",
        expected: "qwen3-6-27b",
        actual: "llama-3-8b",
      },
    });
  });

  it("rejects a document from a different workspace", () => {
    const result = parseCatalogSpecYaml(
      fullDocument.replace("workspace: default", "workspace: staging"),
      record,
    );

    expect(result).toEqual({
      ok: false,
      error: {
        type: "workspaceMismatch",
        expected: "default",
        actual: "staging",
      },
    });
  });

  it("rejects a document of another kind", () => {
    const result = parseCatalogSpecYaml(
      fullDocument.replace("kind: ModelCatalog", "kind: Endpoint"),
      record,
    );

    expect(result).toEqual({
      ok: false,
      error: { type: "wrongKind", kind: "Endpoint" },
    });
  });

  it.each([
    ["empty text", ""],
    ["a scalar", "just a string"],
    ["a sequence", "- a\n- b\n"],
  ])("rejects %s", (_label, text) => {
    const result = parseCatalogSpecYaml(text, record);

    expect(result).toEqual({ ok: false, error: { type: "notAMapping" } });
  });

  it("reports a syntax error", () => {
    const result = parseCatalogSpecYaml("engine: [unclosed", record);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.type).toBe("syntax");
  });
});
