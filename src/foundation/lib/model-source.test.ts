import { describe, expect, it } from "vitest";
import {
  deriveExternalModelSource,
  deriveRouteModelSource,
  MODEL_SOURCE_PRESETS,
  modelSourceOfEndpointKind,
  modelSourceRank,
  modelSourceSuggestions,
  modelSourceTranslationKey,
  parseStoredModelSource,
  resolveExternalModelSource,
  SELF_HOSTED_MODEL_SOURCE,
} from "./model-source";

describe("parseStoredModelSource", () => {
  it("returns the stored value, trimmed", () => {
    expect(parseStoredModelSource("hybrid")).toBe("hybrid");
    expect(parseStoredModelSource(" government-cloud ")).toBe(
      "government-cloud",
    );
  });

  it("treats a blank value as no source", () => {
    expect(parseStoredModelSource(undefined)).toBeUndefined();
    expect(parseStoredModelSource(null)).toBeUndefined();
    expect(parseStoredModelSource("   ")).toBeUndefined();
  });
});

describe("modelSourceOfEndpointKind", () => {
  it("is self-hosted for an internal endpoint and unknown for an external one", () => {
    expect(modelSourceOfEndpointKind("internal")).toBe(
      SELF_HOSTED_MODEL_SOURCE,
    );
    expect(modelSourceOfEndpointKind("external")).toBeUndefined();
  });
});

describe("deriveExternalModelSource", () => {
  const upstreams = [
    { name: "local", endpoint_ref: "qwen-ie", model_mapping: {} },
    { name: "vendor", model_mapping: {} },
  ];

  it("is self-hosted when every target of the route is an internal endpoint", () => {
    expect(
      deriveExternalModelSource(
        {
          upstreams,
          model_routes: [{ model: "qwen", targets: [{ upstream: "local" }] }],
        },
        "qwen",
      ),
    ).toBe(SELF_HOSTED_MODEL_SOURCE);
  });

  it("implies nothing when a route also reaches another upstream", () => {
    // "All", not "any": a model that fails over to a vendor is not purely
    // self-hosted, and the list, detail and edit pages must agree on that.
    expect(
      deriveExternalModelSource(
        {
          upstreams,
          model_routes: [
            {
              model: "qwen",
              targets: [{ upstream: "local" }, { upstream: "vendor" }],
            },
          ],
        },
        "qwen",
      ),
    ).toBeUndefined();
  });

  it("implies nothing for a route without targets or with an unknown upstream", () => {
    expect(
      deriveExternalModelSource(
        { upstreams, model_routes: [{ model: "qwen", targets: [] }] },
        "qwen",
      ),
    ).toBeUndefined();
    expect(
      deriveExternalModelSource(
        {
          upstreams,
          model_routes: [{ model: "qwen", targets: [{ upstream: "gone" }] }],
        },
        "qwen",
      ),
    ).toBeUndefined();
  });

  it("looks at only the route of the model asked for", () => {
    const spec = {
      upstreams,
      model_routes: [
        { model: "qwen", targets: [{ upstream: "local" }] },
        { model: "gpt-4o", targets: [{ upstream: "vendor" }] },
      ],
    };
    expect(deriveExternalModelSource(spec, "qwen")).toBe(
      SELF_HOSTED_MODEL_SOURCE,
    );
    expect(deriveExternalModelSource(spec, "gpt-4o")).toBeUndefined();
  });

  it("falls back to the upstream mappings for an endpoint without routes", () => {
    const mapping = (models: Record<string, string>) => models;
    const spec = {
      upstreams: [
        {
          endpoint_ref: "qwen-ie",
          model_mapping: mapping({ qwen: "qwen", both: "b" }),
        },
        { model_mapping: mapping({ "gpt-4o": "gpt-4o", both: "b" }) },
      ],
    };
    expect(deriveExternalModelSource(spec, "qwen")).toBe(
      SELF_HOSTED_MODEL_SOURCE,
    );
    expect(deriveExternalModelSource(spec, "gpt-4o")).toBeUndefined();
    expect(deriveExternalModelSource(spec, "both")).toBeUndefined();
    expect(deriveExternalModelSource(spec, "absent")).toBeUndefined();
  });

  it("implies nothing for a model the routes do not name", () => {
    // Routes supersede the mappings, so a mapping key alone exposes nothing.
    expect(
      deriveExternalModelSource(
        {
          upstreams: [
            {
              name: "local",
              endpoint_ref: "qwen-ie",
              model_mapping: { q: "q" },
            },
          ],
          model_routes: [{ model: "qwen", targets: [{ upstream: "local" }] }],
        },
        "q",
      ),
    ).toBeUndefined();
  });

  it("derives one route's source from its own targets", () => {
    expect(
      deriveRouteModelSource(upstreams, { targets: [{ upstream: "local" }] }),
    ).toBe(SELF_HOSTED_MODEL_SOURCE);
    expect(
      deriveRouteModelSource(upstreams, { targets: [{ upstream: "vendor" }] }),
    ).toBeUndefined();
    expect(deriveRouteModelSource(null, { targets: [] })).toBeUndefined();
  });

  it("tolerates a missing spec", () => {
    expect(deriveExternalModelSource(null, "qwen")).toBeUndefined();
    expect(deriveExternalModelSource({}, "qwen")).toBeUndefined();
  });
});

describe("resolveExternalModelSource", () => {
  const spec = {
    upstreams: [
      { name: "local", endpoint_ref: "qwen-ie", model_mapping: {} },
      { name: "vendor", model_mapping: {} },
    ],
    model_routes: [
      { model: "qwen", targets: [{ upstream: "local" }] },
      { model: "gpt-4o", targets: [{ upstream: "vendor" }] },
    ],
  };

  it("prefers the stored source over the derived one", () => {
    expect(
      resolveExternalModelSource(
        { ...spec, model_sources: { qwen: "hybrid" } },
        "qwen",
      ),
    ).toBe("hybrid");
  });

  it("derives the source when nothing is stored", () => {
    expect(resolveExternalModelSource(spec, "qwen")).toBe(
      SELF_HOSTED_MODEL_SOURCE,
    );
  });

  it("resolves each model of one endpoint independently", () => {
    const labelled = {
      ...spec,
      model_sources: { "gpt-4o": "third-party-public" },
    };
    expect(resolveExternalModelSource(labelled, "qwen")).toBe(
      SELF_HOSTED_MODEL_SOURCE,
    );
    expect(resolveExternalModelSource(labelled, "gpt-4o")).toBe(
      "third-party-public",
    );
  });

  it("passes through a value outside the presets", () => {
    expect(
      resolveExternalModelSource(
        { ...spec, model_sources: { "gpt-4o": "government-cloud" } },
        "gpt-4o",
      ),
    ).toBe("government-cloud");
  });

  it("is undefined when nothing is stored and nothing is implied", () => {
    expect(resolveExternalModelSource(spec, "gpt-4o")).toBeUndefined();
    expect(
      resolveExternalModelSource(
        { ...spec, model_sources: { "gpt-4o": "  " } },
        "gpt-4o",
      ),
    ).toBeUndefined();
    expect(resolveExternalModelSource(null, "gpt-4o")).toBeUndefined();
  });
});

describe("modelSourceRank", () => {
  it("orders presets as declared, then other values, then unspecified", () => {
    const ranks = MODEL_SOURCE_PRESETS.map(modelSourceRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(MODEL_SOURCE_PRESETS.length);

    const last = ranks[ranks.length - 1] ?? 0;
    expect(modelSourceRank("government-cloud")).toBeGreaterThan(last);
    expect(modelSourceRank(undefined)).toBeGreaterThan(
      modelSourceRank("government-cloud"),
    );
  });
});

describe("modelSourceTranslationKey", () => {
  it("namespaces the value under modelSource.values", () => {
    expect(modelSourceTranslationKey("hybrid")).toBe(
      "modelSource.values.hybrid",
    );
  });
});

describe("modelSourceSuggestions", () => {
  it("offers the presets when nothing else is in use", () => {
    expect(modelSourceSuggestions([])).toEqual([...MODEL_SOURCE_PRESETS]);
  });

  it("adds the other values in use after the presets, alphabetically", () => {
    expect(
      modelSourceSuggestions([
        { modelSources: { a: "zeta-lab" }, models: ["a"] },
        { modelSources: { b: "alpha-lab", c: "hybrid" }, models: ["b", "c"] },
      ]),
    ).toEqual([...MODEL_SOURCE_PRESETS, "alpha-lab", "zeta-lab"]);
  });

  it("ignores a value left behind by a model the endpoint no longer serves", () => {
    expect(
      modelSourceSuggestions([
        { modelSources: { removed: "retired-lab" }, models: ["kept"] },
      ]),
    ).toEqual([...MODEL_SOURCE_PRESETS]);
  });

  it("tolerates endpoints without any sources", () => {
    expect(
      modelSourceSuggestions([
        { modelSources: null, models: ["a"] },
        { modelSources: undefined, models: [] },
      ]),
    ).toEqual([...MODEL_SOURCE_PRESETS]);
  });
});
