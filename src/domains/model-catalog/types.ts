import type { BaseStatus, Metadata } from "@/foundation/types/basic-types";
import type {
  DeploymentOptions,
  EndpointEngineSpec,
  ModelSpec,
  ReplicaSpec,
  ResourceSpec,
} from "@/foundation/types/serving-types";

enum ModelCatalogPhase {
  PENDING = "Pending",
  READY = "Ready",
  FAILED = "Failed",
  DELETED = "Deleted",
}

// Recipe-fication: optional `base` / `variants` / `features` fields turn a
// ModelCatalog into a parameterized template. When `variants` is non-empty the
// catalog is a "Recipe MC"; otherwise it's a "trivial MC" and behaves exactly
// like before. Field names mirror the Go json tags 1:1 (see
// api/v1/model_catalog_types.go). The recipe shape primitives live in
// foundation so other domains (endpoint) can consume them without an L2
// cross-domain import.
import type {
  RecipeBase,
  RecipeFeature,
  RecipeVariant,
} from "@/foundation/recipe/types";

export type ModelCatalogSpec = {
  model: ModelSpec;
  engine: EndpointEngineSpec;
  resources: ResourceSpec | null;
  replicas: ReplicaSpec | null;
  deployment_options: DeploymentOptions | null;
  variables: Record<string, any> | null;
  env: Record<string, string> | null;
  // Recipe extension (all optional)
  base?: RecipeBase | null;
  variants?: Record<string, RecipeVariant> | null;
  features?: RecipeFeature[] | null;
};

export type ModelCatalogStatus = BaseStatus<ModelCatalogPhase>;

export type ModelCatalog = {
  id: number;
  api_version: string;
  kind: string;
  metadata: Metadata;
  spec: ModelCatalogSpec;
  status: ModelCatalogStatus | null;
};
