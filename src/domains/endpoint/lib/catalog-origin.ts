import type { FeatureSelection } from "@/foundation/recipe/types";

/**
 * Where an endpoint was deployed from, recorded on the endpoint itself.
 *
 * An endpoint holds the *composed* result of the catalog that produced it, and
 * nothing in its spec says which catalog, which variant or which features that
 * was. So the same endpoint reads as "the fp8 profile of qwen3.6-35b with a 32K
 * context" while it is being created and as a flat list of engine args ever
 * after.
 *
 * This is a record of what happened, not a reference that is followed: the
 * catalog it names may since have changed or been deleted, and nothing here
 * re-derives anything from it. Everything is read defensively — a value that
 * cannot be understood is dropped rather than allowed to hide the parts that
 * can.
 *
 * It lives in annotations rather than in the spec because it says nothing about
 * how to run the endpoint; the control plane neither writes nor reads it, the
 * same way the paused replica count is a label.
 */

/** Split across three keys rather than one blob so the catalog and the variant
 * stay queryable — PostgREST can filter on an annotation, which is what makes
 * "what did this catalog deploy" answerable — and so an unreadable feature list
 * cannot take the rest down with it. */
export const CATALOG_ORIGIN_ANNOTATION = "neutree.ai/model-catalog";
export const CATALOG_ORIGIN_VARIANT_ANNOTATION =
  "neutree.ai/model-catalog-variant";
export const CATALOG_ORIGIN_FEATURES_ANNOTATION =
  "neutree.ai/model-catalog-features";

export type CatalogOrigin = {
  /** The catalog's name. Endpoints and catalogs are looked up by
   * (workspace, name) everywhere, and an endpoint is always deployed from a
   * catalog in its own workspace. */
  catalog: string;
  /** Absent for a plain catalog, which has no variants to choose between. */
  variant?: string;
  features: FeatureSelection[];
  /** The feature list was recorded but could not be read back. Said out loud
   * rather than shown as "no features", which is a different fact. */
  featuresUnreadable: boolean;
};

type Annotations = Record<string, string> | null | undefined;

export function buildCatalogOriginAnnotations(origin: {
  catalog: string;
  variant?: string;
  features?: ReadonlyArray<FeatureSelection>;
}): Record<string, string> {
  const annotations: Record<string, string> = {
    [CATALOG_ORIGIN_ANNOTATION]: origin.catalog,
  };

  if (origin.variant) {
    annotations[CATALOG_ORIGIN_VARIANT_ANNOTATION] = origin.variant;
  }

  // Order is part of the record: composition applies features in selection
  // order and later ones overwrite earlier ones, so a set would lose meaning.
  if (origin.features && origin.features.length > 0) {
    annotations[CATALOG_ORIGIN_FEATURES_ANNOTATION] = JSON.stringify(
      origin.features.map((feature) =>
        feature.value === undefined
          ? { name: feature.name }
          : { name: feature.name, value: feature.value },
      ),
    );
  }

  return annotations;
}

export function readCatalogOrigin(
  annotations: Annotations,
): CatalogOrigin | null {
  const catalog = annotations?.[CATALOG_ORIGIN_ANNOTATION];
  if (!catalog) return null;

  const variant = annotations?.[CATALOG_ORIGIN_VARIANT_ANNOTATION];
  const raw = annotations?.[CATALOG_ORIGIN_FEATURES_ANNOTATION];

  if (!raw) {
    return {
      catalog,
      ...(variant ? { variant } : {}),
      features: [],
      featuresUnreadable: false,
    };
  }

  const features = parseFeatures(raw);

  return {
    catalog,
    ...(variant ? { variant } : {}),
    features: features ?? [],
    featuresUnreadable: features === null,
  };
}

function parseFeatures(raw: string): FeatureSelection[] | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;

  const features: FeatureSelection[] = [];

  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") return null;

    const { name, value } = entry as { name?: unknown; value?: unknown };
    if (typeof name !== "string" || !name) return null;

    features.push(typeof value === "string" ? { name, value } : { name });
  }

  return features;
}
