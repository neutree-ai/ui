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
};

export type RecipeFeature = {
  description?: string;
  default?: boolean;
  /** Free-form grouping hint for the UI; "tuning" goes under a separate
   * "Performance tuning" section. No effect on composition. */
  category?: string;
  engine_args?: Record<string, unknown> | null;
  env?: Record<string, string> | null;
  conflicts_with?: string[] | null;
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
  features?: Record<string, RecipeFeature> | null;
};
