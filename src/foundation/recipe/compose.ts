import { DEFAULT_VARIANT, normalizeRecipe } from "./normalize";
import type { ComposedSpec, ComposeResult, RecipeInputSpec } from "./types";

/**
 * composeEndpointSpec is the canonical (mc, variant, enabledFeatures) →
 * concrete endpoint kernel function. It MUST stay byte-equivalent with the Go
 * implementation in internal/recipe/compose.go:
 *
 *   merge order (last write wins):
 *     base.engine_args
 *       ← variant.engine_args
 *       ← features[i].engine_args (in enabled order)
 *   same for env.
 *
 * Merge is shallow at the top level of engine_args (vllm flag semantics:
 * value replacement, not field-level deep merge).
 */
export function composeEndpointSpec(
  mc: RecipeInputSpec,
  variant: string,
  enabledFeatures: ReadonlyArray<string>,
): ComposeResult {
  const recipe = normalizeRecipe(mc);

  const variantKey = variant === "" ? DEFAULT_VARIANT : variant;
  const v = recipe.variants[variantKey];
  if (!v) {
    return { ok: false, error: `unknown variant: ${variantKey}` };
  }

  // Validate features
  for (const f of enabledFeatures) {
    if (!recipe.features[f]) {
      return { ok: false, error: `unknown feature: ${f}` };
    }
  }
  // Conflict check: any two enabled features that list each other
  for (let i = 0; i < enabledFeatures.length; i++) {
    const a = enabledFeatures[i];
    const conflicts = recipe.features[a].conflicts_with ?? [];
    for (let j = 0; j < enabledFeatures.length; j++) {
      if (i === j) continue;
      const b = enabledFeatures[j];
      if (conflicts.includes(b)) {
        return {
          ok: false,
          error: `feature conflict: '${a}' conflicts with '${b}'`,
        };
      }
    }
  }

  // Merge engine_args (shallow)
  const engineArgs: Record<string, unknown> = {};
  shallowAssign(engineArgs, recipe.base.engine_args);
  shallowAssign(engineArgs, v.engine_args);
  for (const f of enabledFeatures) {
    shallowAssign(engineArgs, recipe.features[f].engine_args);
  }

  // Merge env
  const env: Record<string, string> = {};
  assignStringMap(env, recipe.base.env);
  assignStringMap(env, v.env);
  for (const f of enabledFeatures) {
    assignStringMap(env, recipe.features[f].env);
  }

  const composed: ComposedSpec = {
    model: v.model ?? mc.model ?? null,
    resources: v.resources ?? mc.resources ?? null,
    engine: recipe.engine ?? null,
    engine_args: engineArgs,
    env,
  };

  return { ok: true, spec: composed };
}

function shallowAssign(
  target: Record<string, unknown>,
  source: Record<string, unknown> | null | undefined,
): void {
  if (!source) return;
  for (const [k, v] of Object.entries(source)) {
    target[k] = v;
  }
}

function assignStringMap(
  target: Record<string, string>,
  source: Record<string, string> | null | undefined,
): void {
  if (!source) return;
  for (const [k, v] of Object.entries(source)) {
    target[k] = v;
  }
}

/**
 * defaultEnabledFeatures returns the set of features whose `default` is true.
 * Order is the iteration order of the features map (matches JSON object order).
 */
export function defaultEnabledFeatures(mc: RecipeInputSpec): string[] {
  const out: string[] = [];
  for (const [k, f] of Object.entries(mc.features ?? {})) {
    if (f?.default) out.push(k);
  }
  return out;
}
