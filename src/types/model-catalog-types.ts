import type { Json } from "./api-gen";
import type { Metadata } from "./basic-types";
import type {
  EndpointEngineSpec,
  ModelSpec,
  ReplicaSpec,
  ResourceSpec,
} from "./endpoint-types";

export enum ModelCatalogPhase {
  PENDING = "Pending",
  READY = "Ready",
  FAILED = "Failed",
  DELETED = "Deleted",
}

export type ModelCatalogSpec = {
  model: ModelSpec;
  engine: EndpointEngineSpec;
  resources: ResourceSpec;
  replicas: ReplicaSpec;
  deployment_options: Json | null;
  variables: Json | null;
};

export type ModelCatalogStatus = {
  phase: ModelCatalogPhase | null;
  last_transition_time: string | null;
  error_message: string | null;
};

export type ModelCatalog = {
  id: number;
  api_version: string;
  kind: string;
  metadata: Metadata;
  spec: ModelCatalogSpec;
  status: ModelCatalogStatus | null;
};
