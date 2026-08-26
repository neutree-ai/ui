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
  /** The two widths an MLA layer caches per token: the compressed latent and
   * the decoupled RoPE key. Absent on a model that does not use MLA, and the
   * only thing that tells the two cache layouts apart — an MLA checkpoint
   * states num_key_value_heads and head_dim as well. */
  kv_lora_rank?: number;
  qk_rope_head_dim?: number;
  /** The per-layer attention kind, verbatim as the checkpoint states it
   * ("full_attention", "sliding_attention", "mamba", …). The vocabulary is
   * open; a reader that does not recognise a kind must not assume it caches
   * like full attention. Absent when the checkpoint states nothing, which is
   * not a claim that the layers are alike. */
  layer_types?: string[];
  /** The window a sliding layer caches, in tokens. Reported only when the same
   * checkpoint also says which layers it applies to, so its presence means the
   * window is in force and not merely mentioned. */
  sliding_window?: number;
  /** The widths of one linear-attention layer's recurrent state. Such a layer
   * caches a fixed-size state per sequence instead of a key and value per
   * token, so none of the head fields describe it and its cost does not grow
   * with the sequence. */
  linear_conv_kernel_dim?: number;
  linear_num_key_heads?: number;
  linear_key_head_dim?: number;
  linear_num_value_heads?: number;
  linear_value_head_dim?: number;
  /** The dtype that recurrent state is held in, which is routinely wider than
   * the weights — float32 state on a bfloat16 checkpoint — so parameter_dtype
   * is not a stand-in for it. */
  recurrent_state_dtype?: string;
  /** DeepSeek V4's per-layer sparse-attention schedule: how many tokens each
   * layer folds into one cached slot, zero meaning it keeps only its window.
   * Entries beyond num_hidden_layers describe the draft modules, one each. */
  compress_ratios?: number[];
  /** The sparse-attention indexer. Only index_head_dim is a cache width; the
   * other two size the query side and the selection budget. */
  index_n_heads?: number;
  index_head_dim?: number;
  index_topk?: number;
  /** Transformer layers in one multi-token-prediction module. Not a module
   * count — no config states one — so a reader that needs how many modules a
   * checkpoint holds takes it from the length of compress_ratios. */
  mtp_num_layers?: number;
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
