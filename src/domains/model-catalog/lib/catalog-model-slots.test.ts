import { describe, expect, it } from "vitest";
import {
  type CatalogModelSlot,
  readCatalogEngine,
  readCatalogModelSlots,
  slotKey,
  writeCatalogEngineVersion,
  writeCatalogModelSlot,
} from "./catalog-model-slots";

const plain = {
  apiVersion: "v1",
  kind: "ModelCatalog",
  metadata: { name: "qwen", workspace: "team-a" },
  spec: {
    model: { registry: "huggingface", name: "Qwen/Qwen3-8B", file: "*.gguf" },
    engine: { engine: "vllm", version: "0.24" },
  },
};

const recipe = {
  apiVersion: "v1",
  kind: "ModelCatalog",
  metadata: { name: "qwen", workspace: "team-a" },
  spec: {
    variants: {
      bf16: { model: { registry: "huggingface", name: "Qwen/Qwen3-27B" } },
      fp8: { model: { registry: "huggingface", name: "Qwen/Qwen3-27B-FP8" } },
    },
    features: [{ name: "max-model-len" }],
    base: { engine_args: { reasoning_parser: "qwen3" } },
  },
};

const slotOf = (doc: unknown, key: string) =>
  readCatalogModelSlots(doc).find((slot) => slotKey(slot) === key);

const variant = (key: string): CatalogModelSlot => ({
  kind: "variant",
  key,
  model: null,
});

describe("readCatalogModelSlots", () => {
  it("finds the one model a plain catalog names", () => {
    expect(readCatalogModelSlots(plain)).toEqual([
      { kind: "catalog", model: plain.spec.model },
    ]);
  });

  // The server refuses a recipe carrying a top-level model, so a recipe's
  // models are exactly its variants' — there is no fallback to offer.
  it("finds one per variant, in declaration order, and no catalog-level slot", () => {
    expect(readCatalogModelSlots(recipe).map(slotKey)).toEqual([
      "variant.bf16",
      "variant.fp8",
    ]);
  });

  // Not a legal stored state — the server refuses a variant with no model — so
  // it means the text is mid-edit, which is exactly when the picker helps.
  it("offers a slot for a variant whose model the text does not name", () => {
    const doc = { kind: "ModelCatalog", spec: { variants: { small: {} } } };

    expect(slotOf(doc, "variant.small")?.model).toBeNull();
  });

  it("accepts a bare spec, which is what a pasted document may be", () => {
    expect(readCatalogModelSlots(plain.spec)).toEqual([
      { kind: "catalog", model: plain.spec.model },
    ]);
  });

  // A half-typed `variants:` can be a string or a list, and indexing those
  // yields one bogus variant per character.
  it("does not read variants out of something that is not a mapping", () => {
    const doc = { kind: "ModelCatalog", spec: { variants: "abc" } };

    expect(readCatalogModelSlots(doc)).toEqual([
      { kind: "catalog", model: null },
    ]);
  });

  it("reads nothing out of a document with no usable spec", () => {
    expect(readCatalogModelSlots({ kind: "ModelCatalog" })).toEqual([]);
    expect(readCatalogModelSlots("not a document")).toEqual([]);
    expect(readCatalogModelSlots(null)).toEqual([]);
  });
});

describe("writeCatalogModelSlot", () => {
  const catalogSlot: CatalogModelSlot = { kind: "catalog", model: null };

  it("repoints the catalog's model and leaves the rest alone", () => {
    const next = writeCatalogModelSlot(plain, catalogSlot, {
      registry: "local-nfs",
      name: "qwen3-8b",
      version: "v2",
    }) as typeof plain;

    expect(next.spec.model).toEqual({
      registry: "local-nfs",
      name: "qwen3-8b",
      version: "v2",
      file: "*.gguf",
    });
    expect(next.spec.engine).toEqual(plain.spec.engine);
    expect(next.metadata).toEqual(plain.metadata);
  });

  // No registry reports a model's files, so the picker cannot fill `file` in.
  // A user repointing a GGUF catalog at their own copy still needs it.
  it("keeps the model file the slot already held", () => {
    const next = writeCatalogModelSlot(plain, catalogSlot, {
      registry: "local-nfs",
      name: "qwen3-8b",
    }) as typeof plain;

    expect(next.spec.model.file).toBe("*.gguf");
  });

  it("repoints one variant without touching the others", () => {
    const next = writeCatalogModelSlot(recipe, variant("fp8"), {
      registry: "local-nfs",
      name: "qwen3-27b-fp8",
    }) as typeof recipe;

    expect(next.spec.variants.fp8.model).toMatchObject({
      registry: "local-nfs",
      name: "qwen3-27b-fp8",
    });
    expect(next.spec.variants.bf16).toEqual(recipe.spec.variants.bf16);
    expect(next.spec.features).toEqual(recipe.spec.features);
    expect(next.spec.base).toEqual(recipe.spec.base);
  });

  it("names the model of a variant that had none", () => {
    const doc = { kind: "ModelCatalog", spec: { variants: { small: {} } } };

    const next = writeCatalogModelSlot(doc, variant("small"), {
      registry: "local-nfs",
      name: "small-one",
    });

    expect(slotOf(next, "variant.small")?.model).toMatchObject({
      name: "small-one",
    });
  });

  // The parameters describe the model that was picked; leaving the previous
  // one's standing would render them under the new model's name. The key is
  // dropped rather than set to undefined, so the document is right for any
  // consumer and not only for a serializer that erases undefined values.
  it("replaces the static parameters rather than merging them", () => {
    const doc = {
      kind: "ModelCatalog",
      spec: {
        model: { registry: "r", name: "a", info: { parameter_count: "72B" } },
      },
    };

    const next = writeCatalogModelSlot(doc, catalogSlot, {
      registry: "r",
      name: "b",
      info: { parameter_count: "8B" },
    });
    expect(slotOf(next, "catalog")?.model?.info).toEqual({
      parameter_count: "8B",
    });

    const cleared = writeCatalogModelSlot(doc, catalogSlot, {
      registry: "r",
      name: "c",
    }) as typeof doc;
    expect("info" in cleared.spec.model).toBe(false);
  });

  it("leaves a document it cannot address untouched", () => {
    expect(
      writeCatalogModelSlot(recipe, variant("nope"), {
        registry: "r",
        name: "n",
      }),
    ).toEqual(recipe);
  });
});

describe("readCatalogEngine", () => {
  const withEngine = {
    kind: "ModelCatalog",
    spec: { engine: { engine: "vllm", version: "0.24" }, variants: {} },
  };

  it("reads the catalog's engine and version", () => {
    expect(readCatalogEngine(withEngine)).toEqual({
      engine: "vllm",
      version: "0.24",
    });
  });

  it("reports an engine that names no version", () => {
    expect(
      readCatalogEngine({
        kind: "ModelCatalog",
        spec: { engine: { engine: "vllm" } },
      }),
    ).toEqual({ engine: "vllm", version: "" });
  });

  it("reads nothing when the catalog names no engine", () => {
    const noEngine = { kind: "ModelCatalog", spec: { model: { name: "m" } } };

    expect(readCatalogEngine(noEngine)).toBeNull();
    // A scalar under `engine` is a half-typed document, not an engine.
    expect(
      readCatalogEngine({ kind: "ModelCatalog", spec: { engine: "vllm" } }),
    ).toBeNull();
    expect(readCatalogEngine(null)).toBeNull();
  });
});

describe("writeCatalogEngineVersion", () => {
  // Switching engine outright would invalidate every engine arg the catalog
  // carries, so only the version moves.
  it("moves the version and keeps the engine", () => {
    const doc = {
      kind: "ModelCatalog",
      spec: {
        engine: { engine: "vllm", version: "0.24" },
        model: { registry: "r", name: "m" },
      },
    };

    const next = writeCatalogEngineVersion(doc, "0.25") as typeof doc;

    expect(next.spec.engine).toEqual({ engine: "vllm", version: "0.25" });
    expect(next.spec.model).toEqual(doc.spec.model);
  });

  it("leaves a document naming no engine untouched", () => {
    const noEngine = { kind: "ModelCatalog", spec: { model: { name: "m" } } };

    expect(writeCatalogEngineVersion(noEngine, "0.25")).toEqual(noEngine);
  });
});
