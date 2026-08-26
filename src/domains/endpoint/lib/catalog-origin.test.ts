import { describe, expect, it } from "vitest";
import {
  buildCatalogOriginAnnotations,
  CATALOG_ORIGIN_ANNOTATION,
  CATALOG_ORIGIN_FEATURES_ANNOTATION,
  CATALOG_ORIGIN_VARIANT_ANNOTATION,
  readCatalogOrigin,
} from "./catalog-origin";

describe("buildCatalogOriginAnnotations", () => {
  it("records the catalog, the variant and the features", () => {
    expect(
      buildCatalogOriginAnnotations({
        catalog: "qwen3.6-35b",
        variant: "fp8",
        features: [{ name: "max-model-len", value: "32768" }, { name: "cp" }],
      }),
    ).toEqual({
      [CATALOG_ORIGIN_ANNOTATION]: "qwen3.6-35b",
      [CATALOG_ORIGIN_VARIANT_ANNOTATION]: "fp8",
      [CATALOG_ORIGIN_FEATURES_ANNOTATION]:
        '[{"name":"max-model-len","value":"32768"},{"name":"cp"}]',
    });
  });

  // Composition applies features in order and later ones overwrite earlier
  // ones, so a set would lose meaning.
  it("keeps the feature order", () => {
    const annotations = buildCatalogOriginAnnotations({
      catalog: "c",
      features: [{ name: "b" }, { name: "a" }],
    });

    expect(readCatalogOrigin(annotations)?.features.map((f) => f.name)).toEqual(
      ["b", "a"],
    );
  });

  // A plain catalog has no variants to choose between, and writing an empty
  // one would read as "some variant, unnamed".
  it("writes only the catalog when there is nothing else to say", () => {
    expect(buildCatalogOriginAnnotations({ catalog: "plain" })).toEqual({
      [CATALOG_ORIGIN_ANNOTATION]: "plain",
    });
  });
});

describe("readCatalogOrigin", () => {
  it("round-trips what was written", () => {
    const origin = {
      catalog: "qwen3.6-35b",
      variant: "fp8",
      features: [{ name: "max-model-len", value: "32768" }],
    };

    expect(readCatalogOrigin(buildCatalogOriginAnnotations(origin))).toEqual({
      ...origin,
      featuresUnreadable: false,
    });
  });

  it("reads nothing off an endpoint that names no catalog", () => {
    expect(readCatalogOrigin(null)).toBeNull();
    expect(readCatalogOrigin({})).toBeNull();
    expect(
      readCatalogOrigin({ [CATALOG_ORIGIN_VARIANT_ANNOTATION]: "fp8" }),
    ).toBeNull();
  });

  // Best effort: an unreadable feature list must not take the catalog and the
  // variant down with it, and must not be shown as "no features" either.
  it("keeps the catalog and variant when the feature list cannot be read", () => {
    const origin = readCatalogOrigin({
      [CATALOG_ORIGIN_ANNOTATION]: "qwen3.6-35b",
      [CATALOG_ORIGIN_VARIANT_ANNOTATION]: "fp8",
      [CATALOG_ORIGIN_FEATURES_ANNOTATION]: "{not json",
    });

    expect(origin).toEqual({
      catalog: "qwen3.6-35b",
      variant: "fp8",
      features: [],
      featuresUnreadable: true,
    });
  });

  it("rejects a feature list of the wrong shape rather than half-reading it", () => {
    for (const raw of ['{"name":"a"}', '["a"]', '[{"value":"1"}]', "[null]"]) {
      const origin = readCatalogOrigin({
        [CATALOG_ORIGIN_ANNOTATION]: "c",
        [CATALOG_ORIGIN_FEATURES_ANNOTATION]: raw,
      });
      expect(origin?.featuresUnreadable).toBe(true);
      expect(origin?.features).toEqual([]);
    }
  });

  it("distinguishes no features from unreadable features", () => {
    const none = readCatalogOrigin({ [CATALOG_ORIGIN_ANNOTATION]: "c" });

    expect(none).toEqual({
      catalog: "c",
      features: [],
      featuresUnreadable: false,
    });
  });
});
