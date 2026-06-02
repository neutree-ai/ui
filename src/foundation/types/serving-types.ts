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
  accelerator: {
    type: string;
    product: string;
    virtualization?: {
      memory_mib?: number | null;
      memory_percent?: number | null;
      core_percent?: number | null;
    } | null;
  } | null;
  memory: number | null;
};

export type ReplicaSpec = {
  num: number;
};

export type DeploymentOptions = {
  scheduler: {
    type: string;
  };
};
