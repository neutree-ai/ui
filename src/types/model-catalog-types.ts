import type { BaseStatus, Metadata } from "./basic-types";
import type {
  DeploymentOptions,
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
  resources: ResourceSpec | null;
  replicas: ReplicaSpec | null;
  deployment_options: DeploymentOptions | null;
  variables: Record<string, any> | null;
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
