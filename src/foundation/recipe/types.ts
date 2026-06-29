// Recipe domain types — kept 1:1 with the Go side
// (api/v1/model_catalog_types.go + internal/recipe/compose.go).

import type {
  DeploymentOptions,
  EndpointEngineSpec,
  ModelSpec,
  ReplicaSpec,
  ResourceSpec,
} from "@/foundation/types/serving-types";

export type RecipeBase = {
  engine_args?: Record<string, unknown> | null;
  env?: Record<string, string> | null;
};

export type RecipeVariant = {
  model?: ModelSpec | null;
  resources?: ResourceSpec | null;
  engine_args?: Record<string, unknown> | null;
  env?: Record<string, string> | null;
  description?: string;
  /** Minimum total VRAM (in GB) needed to load + serve this variant; mirrors
   * upstream `vram_minimum_gb`. Feeds the OOM-risk warning. */
  vram_minimum_gb?: number | null;
};

/** How a feature is selected and composed. Empty/undefined == "boolean". */
export type RecipeFeatureType = "boolean" | "select" | "input";

/** One choice of a select feature. Its engine_args/env merge on top of the
 * feature's shared engine_args/env when chosen. */
export type RecipeFeatureOption = {
  description?: string;
  engine_args?: Record<string, unknown> | null;
  env?: Record<string, string> | null;
};

/** Free-input feature config: the user value replaces "${value}" inside the
 * feature's engine_args/env (coerced to value_type). */
export type RecipeFeatureInput = {
  value_type?: "string" | "int" | "number" | "bool";
  default?: string;
  required?: boolean;
  min?: number | null;
  max?: number | null;
  pattern?: string;
  enum?: string[] | null;
  /** Preset values for a "pick or type" combobox (select + free input). UI
   * hint only — any value satisfying the constraints is still accepted. Each
   * entry is a bare value string, or `{ value, label }` to show a friendly
   * label (e.g. "8K") while still composing the raw `value` ("8192"). */
  suggestions?: Array<string | RecipeInputSuggestion> | null;
};

type RecipeInputSuggestion = {
  value: string;
  label?: string;
};

export type RecipeFeature = {
  /** Stable identifier (referenced by FeatureSelection and conflicts_with).
   * Was the map key before features became an ordered list. */
  name: string;
  /** UI section label this feature renders under (e.g. "核心参数" /
   * "Performance tuning"); empty means the default section. Features sharing a
   * group render together; sections appear in first-seen order. No effect on
   * composition. Supersedes the former free-form `category` hint. */
  group?: string;
  /** Optional human-facing label; falls back to `name` when empty. */
  display_name?: string;
  description?: string;
  conflicts_with?: string[] | null;
  /** Feature shape; empty/undefined == "boolean". */
  type?: RecipeFeatureType;
  // boolean
  default?: boolean;
  engine_args?: Record<string, unknown> | null;
  env?: Record<string, string> | null;
  // select
  options?: Record<string, RecipeFeatureOption> | null;
  default_option?: string;
  // input
  input?: RecipeFeatureInput | null;
};

/** One entry in an endpoint's ordered recipe feature selection. Value
 * semantics depend on the feature's type: boolean ignores it; select stores
 * the chosen option key; input stores the raw user value. */
export type FeatureSelection = {
  name: string;
  value?: string;
};

/**
 * NormalizedRecipe is the "always has variants" view of any ModelCatalogSpec.
 * A trivial MC becomes a single `default` variant whose Model/Resources are
 * the MC's top-level Model/Resources, and whose Base equals the MC's
 * `{ engine_args: variables.engine_args, env }`.
 */
export type NormalizedRecipe = {
  base: RecipeBase;
  variants: Record<string, RecipeVariant>;
  features: Record<string, RecipeFeature>;
  engine?: EndpointEngineSpec | null;
};

/**
 * ComposedSpec is the output of composing a (recipe, variant, features) tuple:
 * the concrete fields that ultimately go onto an EndpointSpec.
 */
export type ComposedSpec = {
  model: ModelSpec | null;
  resources: ResourceSpec | null;
  engine: EndpointEngineSpec | null;
  engine_args: Record<string, unknown>;
  env: Record<string, string>;
};

export type ComposeResult =
  | { ok: true; spec: ComposedSpec }
  | { ok: false; error: string };

/**
 * RecipeInputSpec is the structural shape compose/normalize operate on —
 * intentionally a subset of ModelCatalogSpec so this module stays
 * dependency-free from the model-catalog domain. The model-catalog domain's
 * ModelCatalogSpec is a strict superset.
 */
export type RecipeInputSpec = {
  model?: ModelSpec | null;
  engine?: EndpointEngineSpec | null;
  resources?: ResourceSpec | null;
  replicas?: ReplicaSpec | null;
  deployment_options?: DeploymentOptions | null;
  variables?: Record<string, unknown> | null;
  env?: Record<string, string> | null;
  base?: RecipeBase | null;
  variants?: Record<string, RecipeVariant> | null;
  features?: RecipeFeature[] | null;
};
