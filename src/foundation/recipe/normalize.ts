import type {
  NormalizedRecipe,
  RecipeFeature,
  RecipeInputSpec,
  RecipeVariant,
} from "./types";

export const DEFAULT_VARIANT = "default";

/**
 * isRecipeShape returns true when an MC spec uses the recipe extension.
 */
export function isRecipeShape(
  spec: Pick<RecipeInputSpec, "variants"> | null | undefined,
): boolean {
  if (!spec) return false;
  const variants = spec.variants;
  return !!variants && Object.keys(variants).length > 0;
}

/**
 * normalizeRecipe collapses any catalog-shaped input (trivial or recipe) into
 * a NormalizedRecipe view. Trivial MCs are mapped to a single `default`
 * variant carrying their top-level model/resources, and base.engine_args is
 * sourced from `variables.engine_args` (mirroring the Go side).
 */
export function normalizeRecipe(spec: RecipeInputSpec): NormalizedRecipe {
  if (isRecipeShape(spec)) {
    const variants: Record<string, RecipeVariant> = {};
    for (const [k, v] of Object.entries(spec.variants ?? {})) {
      variants[k] = v ?? {};
    }
    const features: Record<string, RecipeFeature> = {};
    for (const f of spec.features ?? []) {
      if (f?.name) features[f.name] = f;
    }
    return {
      base: {
        engine_args: spec.base?.engine_args ?? {},
        env: spec.base?.env ?? {},
      },
      variants,
      features,
      engine: spec.engine ?? null,
    };
  }

  const variables = spec.variables ?? {};
  const baseEngineArgs =
    (variables.engine_args as Record<string, unknown> | undefined) ?? {};

  return {
    base: {
      engine_args: baseEngineArgs,
      env: spec.env ?? {},
    },
    variants: {
      [DEFAULT_VARIANT]: {
        model: spec.model ?? null,
        resources: spec.resources ?? null,
      },
    },
    features: {},
    engine: spec.engine ?? null,
  };
}
