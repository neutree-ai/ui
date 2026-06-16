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

export type EndpointPlacementSpec = {
  roles?: string;
  replicas?: string;
};

export type ResourceSpec = {
  cpu: number | string | null;
  gpu: number | string | null;
  accelerator: { type: string; product: string } | null;
  memory: number | string | null;
};

export type ReplicaSpec = {
  num: number;
};

export type DeploymentOptions = {
  scheduler: {
    type: string;
  };
};

export type EndpointRoleSpec = {
  name: "prefill" | "decode" | string;
  replicas: ReplicaSpec;
  resources: ResourceSpec;
  deployment_options?: DeploymentOptions | null;
  variables: Record<string, unknown> | null;
  env: Record<string, string> | null;
};

export type KVTransferSpec = {
  connector?: string;
  extra?: Record<string, unknown>;
};

export type KVSpec = {
  transfer?: KVTransferSpec;
};
