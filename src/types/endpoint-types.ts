import type { Metadata } from "./basic-types";

export enum EndpointPhase {
  PENDING = "Pending",
  RUNNING = "Running",
  FAILED = "Failed",
  DELETED = "Deleted",
}

export type ModelSpec = {
  registry: string;
  name: string;
  file: string;
  version: string;
  task: string;
};

export type EndpointEngineSpec = {
  engine: string;
  version: string;
};

export type ResourceSpec = {
  cpu: number | null;
  gpu: number | null;
  accelerator: Record<string, number> | null;
  memory: number | null;
};

export type ReplicaSpec = {
  num: number;
};

export type DeploymentOptions = {
  scheduler: {
    type: string;
    virtual_nodes: number;
    load_factor: number;
  };
};

export type EndpointSpec = {
  cluster: string;
  model: ModelSpec;
  engine: EndpointEngineSpec;
  resources: ResourceSpec | null;
  replicas: ReplicaSpec | null;
  deployment_options: DeploymentOptions | null;
  variables: Record<string, string> | null;
};

export type EndpointStatus = {
  phase: EndpointPhase | null;
  service_url: string | null;
  last_transition_time: string | null;
  error_message: string | null;
};

export type Endpoint = {
  id: number;
  api_version: "v1";
  kind: "Endpoint";
  metadata: Metadata;
  spec: EndpointSpec;
  status: EndpointStatus | null;
};
