import { isRecipeShape } from "@/foundation/recipe/normalize";
import type { ModelCatalogSpec } from "../types";

const asParameterMap = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** The engine arguments a catalog detail page can show as rows.
 *
 * Ordinary catalogs accept both a nested `variables.engine_args` map and
 * direct flags under `variables`. Recipe catalogs can also keep flags in
 * base, variant, and feature entries, so show the union of every presentation
 * source that applies to the catalog. */
export function modelCatalogEngineParameters(
  spec: ModelCatalogSpec,
): Record<string, unknown> {
  const { engine_args: nestedEngineArguments, ...directEngineArguments } =
    spec.variables ?? {};
  const parameters: Record<string, unknown> = {
    ...directEngineArguments,
    ...asParameterMap(nestedEngineArguments),
  };

  if (!isRecipeShape(spec)) return parameters;

  Object.assign(parameters, spec.base?.engine_args ?? {});
  for (const variant of Object.values(spec.variants ?? {})) {
    Object.assign(parameters, variant?.engine_args ?? {});
  }
  for (const feature of spec.features ?? []) {
    Object.assign(parameters, feature?.engine_args ?? {});
  }
  return parameters;
}
