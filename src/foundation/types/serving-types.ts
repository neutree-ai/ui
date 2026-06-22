export type ModelSpec = {
  registry: string;
  name: string;
  file: string;
  version: string;
  task: string;
  /** Display-only model metadata (parameter count, quantization, context
   * length, architecture). Belongs to the model, not the deployment template,
   * and never participates in compose — mirrors Go api/v1 ModelSpec.Info. */
  info?: ModelInfo | null;
};

export type ModelInfo = {
  parameter_count?: string;
  quantization?: string;
  context_length?: string;
  architecture?: string;
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
