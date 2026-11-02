import { isRecipeShape } from "@/foundation/recipe/normalize";
import type { ModelCatalogSpec } from "../types";

const asParameterMap = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** The engine arguments a catalog detail page can show as rows.
 *
 * Ordinary catalogs accept both a nested `variables.engine_args` map and
 * direct flags under `variables`. Recipe catalogs ignore `variables` and keep
 * flags in base, variant, and feature entries, so show the union of those
 * layers. */
export function modelCatalogEngineParameters(
  spec: ModelCatalogSpec,
): Record<string, unknown> {
  if (isRecipeShape(spec)) {
    return Object.assign(
      {},
      spec.base?.engine_args,
      ...Object.values(spec.variants ?? {}).map(
        (variant) => variant?.engine_args,
      ),
      ...(spec.features ?? []).map((feature) => feature?.engine_args),
    );
  }

  const { engine_args: nestedEngineArguments, ...directEngineArguments } =
    spec.variables ?? {};
  return {
    ...directEngineArguments,
    ...asParameterMap(nestedEngineArguments),
  };
}
