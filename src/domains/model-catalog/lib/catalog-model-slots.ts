import {
  isMapping,
  looksLikeDocument,
  type Mapping,
} from "@/domains/model-catalog/lib/parse-catalog-spec-yaml";
import { isRecipeShape } from "@/foundation/recipe/normalize";
import type { RecipeInputSpec } from "@/foundation/recipe/types";
import type { ModelSpec } from "@/foundation/types/serving-types";

/**
 * Every place a catalog names a model, and how to repoint one.
 *
 * A catalog written elsewhere names its author's registry, so the one edit
 * almost every imported catalog needs is "point these at my copies". That is a
 * small, bounded, repetitive change — and the only part of a catalog most users
 * ever need to touch — which is why it gets a form of its own while the rest of
 * the document stays YAML.
 *
 * Where the models are follows from the catalog's shape, which the server
 * enforces (`internal/recipe/validate.go`): a recipe declares one model per
 * variant and may not carry a top-level one, and a plain catalog carries
 * exactly one. There is no inheritance to model — a variant without a model is
 * a document the server refuses, not a variant serving the catalog's model.
 *
 * Everything here reads and returns the parsed document. Callers own the text.
 */

/** The document's spec, whether the input is a whole ModelCatalog or a bare
 * spec — the editor shows the former and users paste both. */
function specOf(doc: unknown): Mapping | null {
  if (!isMapping(doc)) return null;
  if (!looksLikeDocument(doc)) return doc;

  return isMapping(doc.spec) ? doc.spec : null;
}

export type CatalogModelSlot =
  | { kind: "catalog"; model: ModelSpec | null }
  | { kind: "variant"; key: string; model: ModelSpec | null };

/** Stable enough to key a list and address a test id; not parsed back. */
export const slotKey = (slot: CatalogModelSlot) =>
  slot.kind === "catalog" ? "catalog" : `variant.${slot.key}`;

/**
 * Reads every model slot out of a parsed catalog document.
 *
 * A slot with a null model is one the document leaves unnamed. That is not a
 * legal stored state, so it means the text is mid-edit or hand-broken — which
 * is exactly when the picker is worth offering.
 */
export function readCatalogModelSlots(doc: unknown): CatalogModelSlot[] {
  const spec = specOf(doc);
  if (!spec) return [];

  const modelOf = (holder: Mapping) =>
    isMapping(holder.model) ? (holder.model as ModelSpec) : null;

  if (!isRecipeShape(spec as Pick<RecipeInputSpec, "variants">)) {
    return [{ kind: "catalog", model: modelOf(spec) }];
  }

  return Object.entries(spec.variants as Mapping).map(([key, variant]) => ({
    kind: "variant" as const,
    key,
    model: isMapping(variant) ? modelOf(variant) : null,
  }));
}

/** What choosing a model in the picker establishes. Everything else the slot
 * already holds is kept — `file` in particular, which no registry reports and
 * which a user repointing a GGUF catalog at their own copy still needs. */
type CatalogModelSelection = {
  registry: string;
  name: string;
  version?: string;
  info?: ModelSpec["info"];
};

/**
 * Returns the document with one slot repointed at the selected model.
 *
 * The static parameters are replaced rather than merged, so the previous
 * model's are never left standing under the new one's name; a selection that
 * carries none leaves the field off entirely.
 */
export function writeCatalogModelSlot(
  doc: unknown,
  slot: CatalogModelSlot,
  selection: CatalogModelSelection,
): unknown {
  const spec = specOf(doc);
  if (!spec) return doc;

  const repoint = (holder: Mapping): Mapping => {
    // `info` is dropped before the spread rather than overwritten with
    // undefined, so a document that keeps no parameters carries no key for
    // them — the returned document is right for any consumer, not only for a
    // serializer that happens to erase undefined values.
    const { info: _replaced, ...kept } = isMapping(holder.model)
      ? holder.model
      : {};

    return {
      ...holder,
      model: {
        ...kept,
        registry: selection.registry,
        name: selection.name,
        ...(selection.version === undefined
          ? {}
          : { version: selection.version }),
        ...(selection.info ? { info: selection.info } : {}),
      },
    };
  };

  let nextSpec: Mapping;

  if (slot.kind === "catalog") {
    nextSpec = repoint(spec);
  } else {
    const variants = isMapping(spec.variants) ? spec.variants : null;
    const variant = variants?.[slot.key];

    if (!variants || !isMapping(variant)) return doc;

    nextSpec = {
      ...spec,
      variants: { ...variants, [slot.key]: repoint(variant) },
    };
  }

  return spec === doc ? nextSpec : { ...(doc as Mapping), spec: nextSpec };
}
