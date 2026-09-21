import { describe, expect, it } from "vitest";
import {
  EXTERNAL_MODEL_SOURCES,
  externalModelSourceSuggestions,
  INTERNAL_SHARED_MODEL_SOURCE,
  modelSourceFromWorkspaceModelRow,
  modelSourceRank,
  modelSourceTranslationKey,
  modelsViaInternalEndpoint,
  PRESET_MODEL_SOURCES,
  readStoredModelSource,
  resolveModelSource,
  SELF_HOSTED_MODEL_SOURCE,
  WORKSPACE_MODEL_SOURCE_COLUMN,
} from "./model-source";

describe("resolveModelSource", () => {
  it("derives self-hosted for every internal endpoint", () => {
    expect(resolveModelSource("internal")).toBe(SELF_HOSTED_MODEL_SOURCE);
    expect(resolveModelSource("internal", {}, "qwen")).toBe(
      SELF_HOSTED_MODEL_SOURCE,
    );
  });

  it("ignores a stray stored source on an internal endpoint", () => {
    // self-hosted <-> internal must stay one-to-one: it is the only thing
    // distinguishing the internal row from the external row for the same model
    // name in the API-key picker, so a stored value cannot override it.
    expect(
      resolveModelSource("internal", { qwen: "third-party-public" }, "qwen"),
    ).toBe(SELF_HOSTED_MODEL_SOURCE);
  });

  it("reads the stored source for one model of an external endpoint", () => {
    expect(resolveModelSource("external", { qwen: "partner" }, "qwen")).toBe(
      "partner",
    );
  });

  it("resolves each model of one endpoint independently", () => {
    // The reason the source is not stored on the endpoint: one endpoint
    // routinely fronts models of different origin.
    const sources = {
      "from-group": "internal-shared",
      "from-vendor": "third-party-public",
    };
    expect(resolveModelSource("external", sources, "from-group")).toBe(
      "internal-shared",
    );
    expect(resolveModelSource("external", sources, "from-vendor")).toBe(
      "third-party-public",
    );
  });

  it("passes through a slug this build does not know", () => {
    // The enum is extensible server-side; an unrecognised value must survive
    // to the renderer, which shows it verbatim.
    expect(resolveModelSource("external", { m: "government-cloud" }, "m")).toBe(
      "government-cloud",
    );
  });

  it("is undefined when the model has no source, or none was asked for", () => {
    expect(resolveModelSource("external")).toBeUndefined();
    expect(resolveModelSource("external", {}, "qwen")).toBeUndefined();
    expect(
      resolveModelSource("external", { qwen: "   " }, "qwen"),
    ).toBeUndefined();
    // A model not exposed by this endpoint has no source here.
    expect(
      resolveModelSource("external", { qwen: "partner" }, "other"),
    ).toBeUndefined();
    // Without a model name there is nothing to look up.
    expect(resolveModelSource("external", { qwen: "partner" })).toBeUndefined();
  });

  it("never reports self-hosted for an external endpoint that claims it", () => {
    // The server rejects this value here, but a row written before that guard
    // must not be able to impersonate an internal endpoint: the picker tells the
    // two rows for one model name apart by exactly this.
    expect(
      resolveModelSource(
        "external",
        { qwen: SELF_HOSTED_MODEL_SOURCE },
        "qwen",
      ),
    ).toBeUndefined();
    expect(
      readStoredModelSource({ qwen: SELF_HOSTED_MODEL_SOURCE }, "qwen"),
    ).toBeUndefined();
    // ...and it falls through to the derivation rather than blocking it.
    expect(
      resolveModelSource(
        "external",
        { qwen: SELF_HOSTED_MODEL_SOURCE },
        "qwen",
        {
          viaInternalEndpoint: true,
        },
      ),
    ).toBe(INTERNAL_SHARED_MODEL_SOURCE);
  });

  it("keeps self-hosted out of the values offered for an external endpoint", () => {
    expect(readStoredModelSource({}, "qwen")).toBeUndefined();
    expect(EXTERNAL_MODEL_SOURCES).not.toContain(SELF_HOSTED_MODEL_SOURCE);
  });
});

describe("EXTERNAL_MODEL_SOURCES", () => {
  it("offers every preset except self-hosted", () => {
    expect([...EXTERNAL_MODEL_SOURCES]).toEqual(
      PRESET_MODEL_SOURCES.filter((s) => s !== SELF_HOSTED_MODEL_SOURCE),
    );
  });

  it("keeps internal-shared, which is an external endpoint despite its name", () => {
    expect(EXTERNAL_MODEL_SOURCES).toContain("internal-shared");
  });
});

describe("modelSourceRank", () => {
  it("orders presets as declared", () => {
    expect(modelSourceRank(SELF_HOSTED_MODEL_SOURCE)).toBe(0);
    expect(modelSourceRank("internal-shared")).toBe(1);
    expect(modelSourceRank("third-party-public")).toBe(2);
    expect(modelSourceRank("partner")).toBe(3);
  });

  it("sorts unknown slugs after every preset, and unspecified last", () => {
    const unknown = modelSourceRank("government-cloud");
    expect(unknown).toBeGreaterThan(modelSourceRank("partner"));
    expect(modelSourceRank(undefined)).toBeGreaterThan(unknown);
  });
});

describe("modelSourceTranslationKey", () => {
  it("namespaces the slug under modelSource.values", () => {
    expect(modelSourceTranslationKey("partner")).toBe(
      "modelSource.values.partner",
    );
  });
});

describe("modelSourceFromWorkspaceModelRow", () => {
  it("reads the adapter column off an RPC row", () => {
    expect(
      modelSourceFromWorkspaceModelRow({
        model: "qwen",
        [WORKSPACE_MODEL_SOURCE_COLUMN]: "partner",
      }),
    ).toBe("partner");
  });

  it("is undefined when the column is absent, empty or the row is missing", () => {
    // The column is the seam for the not-yet-landed backend migration: until
    // it exists, every row reads as unlabelled rather than throwing.
    expect(modelSourceFromWorkspaceModelRow({ model: "qwen" })).toBeUndefined();
    expect(
      modelSourceFromWorkspaceModelRow({
        [WORKSPACE_MODEL_SOURCE_COLUMN]: "",
      }),
    ).toBeUndefined();
    expect(modelSourceFromWorkspaceModelRow(null)).toBeUndefined();
  });
});

describe("externalModelSourceSuggestions", () => {
  // One endpoint's contribution: what it assigned, and which models it still
  // serves. A source whose model is gone must not count.
  const using = (...sources: string[]) => ({
    modelSources: Object.fromEntries(
      sources.map((source, i) => [`model-${i}`, source]),
    ),
    models: sources.map((_, i) => `model-${i}`),
  });

  it("offers the presets when nothing is in use yet", () => {
    expect(externalModelSourceSuggestions([])).toEqual([
      ...EXTERNAL_MODEL_SOURCES,
    ]);
  });

  it("adds values already in use, after the presets", () => {
    // This is what keeps an open enum from fragmenting: the second person to
    // need a custom source finds it in the list instead of retyping it.
    expect(
      externalModelSourceSuggestions([
        using("acme-research-lab"),
        using("partner"),
        { modelSources: null, models: [] },
        { modelSources: undefined, models: [] },
        { modelSources: {}, models: [] },
      ]),
    ).toEqual([...EXTERNAL_MODEL_SOURCES, "acme-research-lab"]);
  });

  it("ignores a source whose model the endpoint no longer serves", () => {
    // The server prunes these on write, but a client reading a row written
    // before that guard must not resurrect the value either.
    expect(
      externalModelSourceSuggestions([
        {
          modelSources: { gone: "retired-lab", live: "acme-research-lab" },
          models: ["live"],
        },
      ]),
    ).toEqual([...EXTERNAL_MODEL_SOURCES, "acme-research-lab"]);
  });

  it("sorts unknown values alphabetically among themselves", () => {
    expect(
      externalModelSourceSuggestions([using("zeta-lab"), using("alpha-lab")]),
    ).toEqual([...EXTERNAL_MODEL_SOURCES, "alpha-lab", "zeta-lab"]);
  });

  it("never offers self-hosted, even if one is somehow stored", () => {
    expect(
      externalModelSourceSuggestions([using(SELF_HOSTED_MODEL_SOURCE)]),
    ).not.toContain(SELF_HOSTED_MODEL_SOURCE);
  });

  it("does not repeat a preset that is also in use", () => {
    expect(
      externalModelSourceSuggestions([using("partner"), using("partner")]),
    ).toEqual([...EXTERNAL_MODEL_SOURCES]);
  });
});

describe("models reached through an internal endpoint", () => {
  it("derives internal-shared when nothing is stored", () => {
    // An upstream pointing at an endpoint this platform runs makes its models
    // internal by construction; the admin should not have to say so.
    expect(
      resolveModelSource("external", {}, "qwen", { viaInternalEndpoint: true }),
    ).toBe(INTERNAL_SHARED_MODEL_SOURCE);
  });

  it("derives internal-shared, never self-hosted", () => {
    // The row is still an external one. self-hosted has to stay one-to-one with
    // internal endpoints, or the two rows for one model name collapse in the
    // API-key picker.
    expect(
      resolveModelSource("external", {}, "qwen", { viaInternalEndpoint: true }),
    ).not.toBe(SELF_HOSTED_MODEL_SOURCE);
  });

  it("lets an explicit source win over the derivation", () => {
    expect(
      resolveModelSource("external", { qwen: "partner" }, "qwen", {
        viaInternalEndpoint: true,
      }),
    ).toBe("partner");
  });

  it("collects the models an endpoint reaches through an internal endpoint", () => {
    const models = modelsViaInternalEndpoint([
      { endpoint_ref: "e2e-smoke", model_mapping: { a: "x", b: "y" } },
      { endpoint_ref: "", model_mapping: { c: "z" } },
      { endpoint_ref: null, model_mapping: { d: "w" } },
      { model_mapping: { e: "v" } },
    ]);
    expect([...models].sort()).toEqual(["a", "b"]);
  });

  it("is empty for an endpoint with no upstreams at all", () => {
    expect(modelsViaInternalEndpoint(undefined).size).toBe(0);
    expect(modelsViaInternalEndpoint([]).size).toBe(0);
  });
});
