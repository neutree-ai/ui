import { DEFAULT_VARIANT, normalizeRecipe } from "./normalize";
import type {
  ComposedSpec,
  ComposeResult,
  FeatureSelection,
  RecipeFeature,
  RecipeInputSpec,
} from "./types";

const PLACEHOLDER = "${value}";

/**
 * composeEndpointSpec is the canonical (mc, variant, featureSelections) →
 * concrete endpoint kernel function. It MUST stay behaviour-equivalent with
 * the Go implementation in internal/recipe/compose.go:
 *
 *   merge order (last write wins):
 *     base.engine_args
 *       ← variant.engine_args
 *       ← features[i] (in selection order; per type — see below)
 *   same for env.
 *
 * Per feature type:
 *   - boolean: merge the feature's engine_args/env.
 *   - select:  merge the feature's engine_args/env, then the chosen option's.
 *   - input:   merge the feature's engine_args/env with "${value}" replaced by
 *     the user value (coerced to the input value_type).
 *
 * Merge is shallow at the top level of engine_args (vllm flag semantics:
 * value replacement, not field-level deep merge).
 */
export function composeEndpointSpec(
  mc: RecipeInputSpec,
  variant: string,
  selections: ReadonlyArray<FeatureSelection>,
): ComposeResult {
  const recipe = normalizeRecipe(mc);

  const variantKey = variant === "" ? DEFAULT_VARIANT : variant;
  const v = recipe.variants[variantKey];
  if (!v) {
    return { ok: false, error: `unknown variant: ${variantKey}` };
  }

  const validationError = validateSelections(selections, recipe.features);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const engineArgs: Record<string, unknown> = {};
  shallowAssign(engineArgs, recipe.base.engine_args);
  shallowAssign(engineArgs, v.engine_args);

  const env: Record<string, string> = {};
  assignStringMap(env, recipe.base.env);
  assignStringMap(env, v.env);

  for (const sel of selections) {
    const feat = recipe.features[sel.name];
    switch (featureType(feat)) {
      case "select": {
        const opt = feat.options?.[sel.value ?? ""];
        shallowAssign(engineArgs, feat.engine_args);
        assignStringMap(env, feat.env);
        shallowAssign(engineArgs, opt?.engine_args);
        assignStringMap(env, opt?.env);
        break;
      }
      case "input": {
        const val = inputValue(feat, sel);
        if (val === "" && !inputRequired(feat)) break;
        shallowAssign(
          engineArgs,
          substituteArgs(feat.engine_args, val, inputValueType(feat)),
        );
        assignStringMap(env, substituteEnv(feat.env, val));
        break;
      }
      default: {
        shallowAssign(engineArgs, feat.engine_args);
        assignStringMap(env, feat.env);
        break;
      }
    }
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

function featureType(f: RecipeFeature): "boolean" | "select" | "input" {
  return f.type && f.type !== "boolean" ? f.type : "boolean";
}

function inputValueType(f: RecipeFeature): string {
  return f.input?.value_type ?? "string";
}

function inputRequired(f: RecipeFeature): boolean {
  return Boolean(f.input?.required);
}

function inputValue(f: RecipeFeature, sel: FeatureSelection): string {
  if (sel.value) return sel.value;
  return f.input?.default ?? "";
}

function validateSelections(
  selections: ReadonlyArray<FeatureSelection>,
  features: Record<string, RecipeFeature>,
): string | null {
  const seen = new Set<string>();
  for (const sel of selections) {
    if (seen.has(sel.name)) {
      return `feature '${sel.name}' selected more than once`;
    }
    seen.add(sel.name);

    const feat = features[sel.name];
    if (!feat) return `unknown feature: ${sel.name}`;

    if (featureType(feat) === "select") {
      if (!sel.value) {
        return `feature '${sel.name}' (select) requires an option`;
      }
      if (!feat.options?.[sel.value]) {
        return `feature '${sel.name}' has no option '${sel.value}'`;
      }
    } else if (featureType(feat) === "input") {
      const err = validateInputValue(feat, inputValue(feat, sel));
      if (err) return `feature '${sel.name}': ${err}`;
    }
  }

  for (const sel of selections) {
    const conflicts = features[sel.name].conflicts_with ?? [];
    for (const c of conflicts) {
      if (c !== sel.name && seen.has(c)) {
        return `feature conflict: '${sel.name}' conflicts with '${c}'`;
      }
    }
  }

  return null;
}

/** Validates a raw input value; returns an error string or null. */
export function validateInputValue(
  f: RecipeFeature,
  val: string,
): string | null {
  if (val === "") {
    return inputRequired(f) ? "input is required" : null;
  }

  if (f.input?.enum && f.input.enum.length > 0 && !f.input.enum.includes(val)) {
    return `value '${val}' is not one of the allowed values`;
  }

  switch (inputValueType(f)) {
    case "int": {
      if (!/^-?\d+$/.test(val)) return `value '${val}' is not an integer`;
      return checkRange(f, Number(val));
    }
    case "number": {
      const n = Number(val);
      if (!Number.isFinite(n)) return `value '${val}' is not a number`;
      return checkRange(f, n);
    }
    case "bool":
      if (!/^(true|false|1|0|t|f)$/i.test(val)) {
        return `value '${val}' is not a boolean`;
      }
      return null;
    default:
      if (f.input?.pattern) {
        try {
          if (!new RegExp(f.input.pattern).test(val)) {
            return `value '${val}' does not match pattern`;
          }
        } catch {
          return `invalid pattern`;
        }
      }
      return null;
  }
}

function checkRange(f: RecipeFeature, n: number): string | null {
  if (f.input?.min != null && n < f.input.min) {
    return `value ${n} is below minimum ${f.input.min}`;
  }
  if (f.input?.max != null && n > f.input.max) {
    return `value ${n} is above maximum ${f.input.max}`;
  }
  return null;
}

function substituteArgs(
  src: Record<string, unknown> | null | undefined,
  val: string,
  valueType: string,
): Record<string, unknown> | null {
  if (!src) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = substituteValue(v, val, valueType);
  }
  return out;
}

function substituteValue(v: unknown, val: string, valueType: string): unknown {
  if (typeof v !== "string") return v;
  if (v === PLACEHOLDER) return coerce(val, valueType);
  if (v.includes(PLACEHOLDER)) return v.split(PLACEHOLDER).join(val);
  return v;
}

function substituteEnv(
  src: Record<string, string> | null | undefined,
  val: string,
): Record<string, string> | null {
  if (!src) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = v.split(PLACEHOLDER).join(val);
  }
  return out;
}

function coerce(val: string, valueType: string): unknown {
  switch (valueType) {
    case "int":
      if (/^-?\d+$/.test(val)) return Number.parseInt(val, 10);
      return val;
    case "number": {
      const n = Number(val);
      return Number.isFinite(n) ? n : val;
    }
    case "bool":
      if (/^(true|1|t)$/i.test(val)) return true;
      if (/^(false|0|f)$/i.test(val)) return false;
      return val;
    default:
      return val;
  }
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
 * defaultFeatureSelections returns the initial selection for an MC, in feature
 * declaration order: default-on booleans, selects with a default_option, and
 * inputs with a default (or required). This order is the compose override
 * order, so it must match between the form and the backend.
 */
export function defaultFeatureSelections(mc: RecipeInputSpec): FeatureSelection[] {
  const out: FeatureSelection[] = [];
  for (const [name, f] of Object.entries(mc.features ?? {})) {
    if (!f) continue;
    const type = featureType(f);
    if (type === "select") {
      if (f.default_option) out.push({ name, value: f.default_option });
    } else if (type === "input") {
      const def = f.input?.default ?? "";
      if (def !== "" || f.input?.required) out.push({ name, value: def });
    } else if (f.default) {
      out.push({ name });
    }
  }
  return out;
}
