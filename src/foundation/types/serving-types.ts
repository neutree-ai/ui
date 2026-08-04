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

  /* The structured shape of the checkpoint. An absent field is unknown, not
   * zero — the server omits what it could not establish and names it in
   * missing_fields instead. */
  num_hidden_layers?: number;
  num_attention_heads?: number;
  num_key_value_heads?: number;
  head_dim?: number;
  max_position_embeddings?: number;
  is_moe?: boolean;
  num_experts?: number;
  num_experts_per_token?: number;
  parameter_dtype?: string;
  quantization_bits?: number;

  /** Per-field provenance keyed by the field's own JSON name; the values are
   * ModelFieldSource (see @/foundation/types/model-types). */
  field_sources?: Record<string, string>;
  /** The fields the server looked for and could not establish. */
  missing_fields?: string[];
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
