import type { BaseStatus, Metadata } from "@/foundation/types/basic-types";
import type {
  DeploymentOptions,
  EndpointEngineSpec,
  ModelSpec,
  ReplicaSpec,
  ResourceSpec,
} from "@/foundation/types/serving-types";

export type {
  ModelSpec,
  EndpointEngineSpec,
  ResourceSpec,
  ReplicaSpec,
  DeploymentOptions,
} from "@/foundation/types/serving-types";

enum EndpointPhase {
  PENDING = "Pending",
  DEPLOYING = "Deploying",
  RUNNING = "Running",
  PAUSED = "Paused",
  DELETING = "Deleting",
  FAILED = "Failed",
  DELETED = "Deleted",
}

export type EndpointSpec = {
  cluster: string;
  model: ModelSpec;
  engine: EndpointEngineSpec;
  resources: ResourceSpec | null;
  replicas: ReplicaSpec | null;
  deployment_options: DeploymentOptions | null;
  variables: Record<string, any> | null;
  env: Record<string, string> | null;
};

export type EndpointStatus = BaseStatus<EndpointPhase> & {
  service_url: string | null;
};

export type Endpoint = {
  id: number;
  api_version: "v1";
  kind: "Endpoint";
  metadata: Metadata;
  spec: EndpointSpec;
  status: EndpointStatus | null;
};
