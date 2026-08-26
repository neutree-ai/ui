import { modelFieldSource } from "@/foundation/types/model-types";
import type { ModelInfo } from "@/foundation/types/serving-types";

/**
 * KV cache size for a checkpoint, computed from what that checkpoint states
 * about itself.
 *
 * Five cache layouts are covered, and which one a model uses is read off the
 * fields it states rather than off its name:
 *
 *   head (MHA / GQA)      layers × 2 × num_key_value_heads × head_dim, per token
 *   latent (MLA)          layers × (kv_lora_rank + qk_rope_head_dim), per token
 *   mixed full/sliding    full layers per token, sliding layers capped at the window
 *   qwen linear/full      full layers per token, plus a constant recurrent state
 *   deepseek v4           a window per layer, plus compressed slots, plus an indexer
 *
 * Two of those layouts do not scale with the sequence at all, which is the whole
 * reason they need separate formulas rather than a correction factor: a sliding
 * layer stops growing at its window, and a linear-attention layer holds one
 * fixed-size state however long the sequence gets. Applying the head formula to
 * a Qwen3.6-27B counts all 64 layers as token-linear when only 16 of them are,
 * and still misses the ~147 MiB of recurrent state it does have.
 *
 * The result is a list of components rather than one product, because these
 * caches are sums of parts that scale differently. Every component carries the
 * factors it was multiplied out of, each labelled with the checkpoint field it
 * came from and how that field was established.
 *
 * Everything this module cannot establish it refuses, naming the fields it
 * would have needed. There is no default for a missing shape parameter: a
 * plausible number nobody can trace is worse than no number, because a user
 * sizing a deployment has no way to tell it apart from a computed one.
 */

/** Bytes per element of the KV cache, as offered in the precision selector. */
export const KV_CACHE_PRECISIONS = [
  { id: "bf16", bytes: 2 },
  { id: "fp8", bytes: 1 },
  { id: "fp4", bytes: 0.5 },
  { id: "fp32", bytes: 4 },
] as const;

export type KvCachePrecisionId = (typeof KV_CACHE_PRECISIONS)[number]["id"];

/** GB here is 1024³ bytes, matching how the rest of the UI reports memory. */
export const BYTES_PER_GB = 1024 ** 3;

/**
 * The short-convolution history of a linear-attention layer is held at this
 * width. It is not a checkpoint fact and is not presented as one: the config
 * states a dtype for the recurrent state (mamba_ssm_dtype) and says nothing
 * about the convolution window, which current serving implementations keep in
 * BF16 whatever the state dtype is.
 *
 * It is left as a stated assumption rather than promoted to a fourth input
 * because of what it is worth: on Qwen3.6-27B the convolution history is 2.8 MiB
 * against 144 MiB of recurrent state, so halving or doubling it moves the total
 * by under 1%. The recurrent-state width, which does move it, is an input.
 */
const LINEAR_CONV_STATE_BYTES = 2;

/**
 * The compression rates a DeepSeek V4 schedule may state, and the one that
 * carries an indexer.
 *
 * These are not conventions — they are read off the weights. In both released V4
 * checkpoints, across all 104 of their layers with no exceptions, a layer whose
 * compress_ratios entry is 0 carries neither attn.compressor.* nor
 * attn.indexer.*, a layer whose entry is 128 carries the compressor alone, and a
 * layer whose entry is 4 carries both. That is what licenses charging an indexer
 * to the rate-4 layers and only to them.
 *
 * A schedule stating any other rate is refused rather than extrapolated. Two
 * checkpoints using the same two rates cannot tell us whether the indexer
 * follows the value 4 or follows "the finer of the rates in use", and a
 * deployment sized off the wrong reading of that is exactly the confident wrong
 * number this module exists to avoid.
 */
const VERIFIED_COMPRESS_RATES = [0, 4, 128];
const INDEXING_COMPRESS_RATE = 4;

/** The components held at the KV precision the user picked. */
const KV_PRECISION_COMPONENTS: KvCacheComponentKey[] = [
  "full_kv",
  "sliding_kv",
  "compressed_kv",
  "draft_kv",
];

/**
 * The dtype the checkpoint states its weights in, mapped onto a cache
 * precision. It is a starting point for the selector and nothing more: an
 * engine can be told to cache in a narrower type than it holds weights in, so
 * the user owns this input. A dtype we do not recognise leaves the selector
 * empty rather than guessing a width.
 */
export function defaultPrecisionId(
  info: ModelInfo | null | undefined,
): KvCachePrecisionId | null {
  return precisionIdForDtype(info?.parameter_dtype);
}

/**
 * The precision a linear-attention layer's recurrent state defaults to. The
 * checkpoint states this separately from the weight dtype and routinely states
 * it wider — float32 state on a bfloat16 checkpoint — so the weight dtype is not
 * a stand-in for it and an unstated one defaults to nothing.
 */
export function defaultRecurrentStatePrecisionId(
  info: ModelInfo | null | undefined,
): KvCachePrecisionId | null {
  return precisionIdForDtype(info?.recurrent_state_dtype);
}

function precisionIdForDtype(
  dtype: string | undefined,
): KvCachePrecisionId | null {
  const normalized = dtype?.toLowerCase().trim();

  if (!normalized) {
    return null;
  }

  if (/^(bfloat16|bf16|float16|fp16|half)$/.test(normalized)) {
    return "bf16";
  }

  if (/^(float32|fp32|float)$/.test(normalized)) {
    return "fp32";
  }

  if (/^(float8|fp8|int8|uint8)/.test(normalized)) {
    return "fp8";
  }

  if (/^(float4|fp4|nf4|int4|uint4)/.test(normalized)) {
    return "fp4";
  }

  return null;
}

/**
 * Where one number in the formula came from: a ModelInfo provenance for a
 * checkpoint field, "input" for something the user typed, "deployment" for a
 * value taken from the engine args this deployment will be created with —
 * which is a fact about the deployment, not about the checkpoint, and is worth
 * telling apart from both — "constant" for the
 * factor of two that a key and a value make, "unstated" for a value carrying no
 * provenance at all — a legacy catalog entry, or an assumption this module makes
 * because the checkpoint is silent — which is not the same as one the checkpoint
 * vouches for and must not be shown as if it were.
 */
export type KvCacheSource =
  | "auto"
  | "derived"
  | "manual"
  | "input"
  | "deployment"
  | "constant"
  | "unstated";

export type KvCacheValue = {
  /** The ModelInfo field name, or the input's name for a typed-in value. */
  key: string;
  value: number;
  source: KvCacheSource;
  /**
   * For a derived value, the checkpoint field it was counted out of. A layer
   * count is derived from layer_types and a slot count from compress_ratios,
   * and naming the array is what lets a reader check the arithmetic instead of
   * taking the count on trust.
   */
  from?: string;
};

/**
 * One element of the formula.
 *
 * A sum stands for widths that are added before they are multiplied in, and a
 * min for a sliding layer's cap, which is a token count only until the sequence
 * outgrows the window. Both are kept structured so the rendered formula matches
 * the arithmetic instead of showing a total nobody typed.
 */
export type KvCacheFactor =
  | ({ kind: "value" } & KvCacheValue)
  | { kind: "sum"; key: string; value: number; terms: KvCacheValue[] }
  | { kind: "min"; key: string; value: number; terms: KvCacheValue[] };

/**
 * One part of the cache: a product of factors, in bytes. Splitting the estimate
 * this way is what lets a component that does not grow with the sequence sit
 * next to one that does without either being misreported.
 */
export type KvCacheComponent = {
  key: KvCacheComponentKey;
  bytes: number;
  /** Whether this part grows with tokens per sequence. */
  perToken: boolean;
  /** The formula, multiplied left to right, ending in the precision width. */
  factors: KvCacheFactor[];
};

export type KvCacheComponentKey =
  | "full_kv"
  | "sliding_kv"
  | "compressed_kv"
  | "indexer"
  | "linear_conv_state"
  | "linear_recurrent_state"
  | "draft_kv";

export type KvCacheFamily =
  | "head"
  | "latent"
  | "mixed_full_sliding_gqa"
  | "qwen_linear_full_hybrid"
  | "deepseek_v4_hybrid";

export type KvCacheEstimate = {
  ok: true;
  family: KvCacheFamily;
  /**
   * The checkpoint statement that settled the family. The panel shows it because
   * more than one layout can be reached from a checkpoint that states the
   * head fields as well, and "which formula and why" is not obvious from the
   * number.
   */
  familyBasis: KvCacheFamilyBasis;
  components: KvCacheComponent[];
  totalBytes: number;
  /** totalBytes in GB (1024³ bytes). */
  totalGb: number;
  /**
   * totalBytes spread over the cached tokens. It is the exact per-token cost
   * only where every component is token-linear; where a component is not, it is
   * an average at this token count and moves as that count changes.
   */
  bytesPerToken: number;
  /** Whether every component grows with tokens, i.e. whether the average above
   * is also the marginal cost. */
  uniformlyPerToken: boolean;
};

export type KvCacheFamilyBasis =
  | "compress_ratios"
  | "linear_layer_types"
  | "sliding_layer_types"
  | "latent_widths"
  | "uniform_layers";

export type KvCacheRefusal = {
  ok: false;
  reason:
    | "no-model-info"
    | "missing-fields"
    | "layer-types"
    | "compression-rates"
    | "invalid-input";
  /**
   * The checkpoint fields the estimate needed and could not use, by their
   * ModelInfo names — empty unless the reason is missing-fields.
   */
  missingFields: string[];
  /** The distinct layer kinds stated, when those are what blocked the estimate. */
  layerTypes: string[];
  /** The compression rates stated that this module has no evidence for. */
  compressionRates: number[];
};

export type KvCacheResult = KvCacheEstimate | KvCacheRefusal;

/**
 * How many linear-attention states a sequence keeps.
 *
 * A recurrent layer's state is one fixed-size object that the engine can either
 * keep only at the end of the prompt — enough to resume, and what a serving
 * default does — or snapshot every N tokens so a prefix can be re-entered
 * without replaying it. That is a serving policy and not a property of the
 * checkpoint, so it is an input with the common default rather than a number
 * read out of a file.
 */
export type LinearStateCheckpointPolicy =
  | { kind: "prompt-end" }
  | { kind: "fixed-interval"; tokens: number | null };

export type KvCacheInputs = {
  info: ModelInfo | null | undefined;
  tokensPerSequence: number | null;
  sequences: number | null;
  /**
   * Where the two counts above came from. They are inputs and the user owns
   * them, but a value the user has not touched still has a provenance worth
   * showing — the engine args of the deployment being filled in, or the
   * checkpoint's own context length — and reporting all three as "input" would
   * throw that away. Defaults to "input", which is what a typed value is.
   */
  tokensSource?: KvCacheSource;
  sequencesSource?: KvCacheSource;
  bytesPerElement: number | null;
  /**
   * Width of one indexer element. Needed only by a checkpoint whose schedule
   * indexes; a family that does not index ignores it.
   */
  indexerBytesPerElement?: number | null;
  /** Width of one recurrent-state element, for a linear-attention checkpoint. */
  recurrentStateBytesPerElement?: number | null;
  checkpointPolicy?: LinearStateCheckpointPolicy;
  /**
   * Whether to count the linear-attention state at all. A deployment that never
   * resumes a cached prefix does not retain it, and the difference is most of
   * the number on a Qwen hybrid, so it is the user's to say.
   */
  includeLinearState?: boolean;
  /**
   * Whether to count the draft (MTP) modules' KV. Speculative decoding is opt-in
   * per deployment, so its cache is too.
   */
  includeDraftKvCache?: boolean;
};

/**
 * Layer kinds whose cache the head-based and latent formulas describe. Both
 * take one layer's cache and multiply it by the layer count, which only holds
 * while every layer caches the same way.
 */
const FULL_ATTENTION_LAYER_TYPES = ["full_attention", "attention"];
const SLIDING_ATTENTION_LAYER_TYPE = "sliding_attention";
const LINEAR_ATTENTION_LAYER_TYPE = "linear_attention";

const LATENT_FIELDS = ["kv_lora_rank", "qk_rope_head_dim"];
const HEAD_FIELDS = ["num_key_value_heads", "head_dim"];
const LAYERS_FIELD = "num_hidden_layers";
const SLIDING_WINDOW_FIELD = "sliding_window";
const INDEX_HEAD_DIM_FIELD = "index_head_dim";
const MTP_LAYERS_FIELD = "mtp_num_layers";
const LINEAR_FIELDS = [
  "linear_conv_kernel_dim",
  "linear_num_key_heads",
  "linear_key_head_dim",
  "linear_num_value_heads",
  "linear_value_head_dim",
];

function refuse(
  reason: KvCacheRefusal["reason"],
  detail?: {
    missingFields?: string[];
    layerTypes?: string[];
    compressionRates?: number[];
  },
): KvCacheRefusal {
  return {
    ok: false,
    reason,
    missingFields: detail?.missingFields ?? [],
    layerTypes: detail?.layerTypes ?? [],
    compressionRates: detail?.compressionRates ?? [],
  };
}

/** A field usable in the arithmetic: stated, numeric and positive. */
function usableField(info: ModelInfo, field: string): number | null {
  const raw = (info as Record<string, unknown>)[field];

  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return null;
  }

  return raw;
}

function factorFor(
  info: ModelInfo,
  field: string,
  value: number,
): KvCacheValue {
  return {
    key: field,
    value,
    source: modelFieldSource(info, field) ?? "unstated",
  };
}

const valueFactor = (value: KvCacheValue): KvCacheFactor => ({
  kind: "value",
  ...value,
});

const inputFactor = (
  key: string,
  value: number,
  source: KvCacheSource = "input",
): KvCacheFactor => ({
  kind: "value",
  key,
  value,
  source,
});

/**
 * A count this module worked out of an array the checkpoint states. It is
 * derived rather than auto, and it names the array, because the number itself
 * appears nowhere in the config and a reader has to be able to go and count.
 */
const countedFactor = (
  key: string,
  value: number,
  from: string,
): KvCacheFactor => ({ kind: "value", key, value, source: "derived", from });

/** One key and one value per head, which is what the 2 stands for. */
const KEY_AND_VALUE: KvCacheFactor = {
  kind: "value",
  key: "key_and_value",
  value: 2,
  source: "constant",
};

export function estimateKvCache(inputs: KvCacheInputs): KvCacheResult {
  const { info } = inputs;

  if (!info) {
    return refuse("no-model-info");
  }

  const tokens = inputs.tokensPerSequence;
  const sequences = inputs.sequences;
  const bytes = inputs.bytesPerElement;

  if (
    !isPositive(tokens) ||
    !isPositive(sequences) ||
    !isPositive(bytes) ||
    !Number.isInteger(tokens) ||
    !Number.isInteger(sequences)
  ) {
    // The shape is resolved first even so, because a checkpoint that can never
    // be estimated should say so before the user is asked to fix their typing.
    const shape = resolveShape(info, { ...inputs, tokensPerSequence: 1 });

    return shape.ok ? refuse("invalid-input") : shape.refusal;
  }

  const shape = resolveShape(info, inputs);

  if (!shape.ok) {
    return shape.refusal;
  }

  const components = shape.components.map((component) => {
    // The KV precision applies to the components that hold keys and values. The
    // rest carry their own width already, because an indexer entry and a
    // recurrent state are not held at the KV precision and saying they were
    // would make one selector silently move three unrelated numbers.
    const factors = [
      inputFactor("sequences", sequences, inputs.sequencesSource),
      ...component.factors,
      ...(KV_PRECISION_COMPONENTS.includes(component.key)
        ? [inputFactor("bytes_per_element", bytes)]
        : []),
    ];

    return {
      ...component,
      factors,
      bytes: factors.reduce((product, factor) => product * factor.value, 1),
    };
  });

  const totalBytes = components.reduce(
    (sum, component) => sum + component.bytes,
    0,
  );

  return {
    ok: true,
    family: shape.family,
    familyBasis: shape.familyBasis,
    components,
    totalBytes,
    totalGb: totalBytes / BYTES_PER_GB,
    bytesPerToken: totalBytes / (tokens * sequences),
    uniformlyPerToken: components.every((component) => component.perToken),
  };
}

type ResolvedShape =
  | {
      ok: true;
      family: KvCacheFamily;
      familyBasis: KvCacheFamilyBasis;
      /** Components without the sequence count, which is applied uniformly. */
      components: Omit<KvCacheComponent, "bytes">[];
    }
  | { ok: false; refusal: KvCacheRefusal };

/**
 * Picks the cache layout and collects the checkpoint numbers it needs.
 *
 * The order the layouts are tried in is the order of how specific the evidence
 * is, not of how common the model is. A DeepSeek V4 checkpoint states a rope
 * width and would look like a half-described MLA layer if the latent test ran
 * first; a Qwen hybrid states num_key_value_heads and head_dim and would look
 * like a plain GQA model if the head test did. In both cases the more specific
 * statement — a compression schedule, a linear layer kind — is the true one, so
 * it is asked about first.
 */
function resolveShape(info: ModelInfo, inputs: KvCacheInputs): ResolvedShape {
  const kinds = [...new Set(info.layer_types ?? [])];

  if ((info.compress_ratios ?? []).length > 0) {
    return resolveDeepseekV4(info, inputs, kinds);
  }

  if (kinds.includes(LINEAR_ATTENTION_LAYER_TYPE)) {
    return resolveQwenLinearFullHybrid(info, inputs, kinds);
  }

  if (kinds.includes(SLIDING_ATTENTION_LAYER_TYPE)) {
    return resolveMixedFullSlidingGqa(info, inputs, kinds);
  }

  const unsupported = kinds.filter(
    (kind) => !FULL_ATTENTION_LAYER_TYPES.includes(kind),
  );

  if (unsupported.length > 0) {
    return {
      ok: false,
      refusal: refuse("layer-types", { layerTypes: unsupported }),
    };
  }

  return resolveUniform(info, inputs);
}

/** The fields a formula needs, or the refusal naming the ones it did not get. */
function requireFields(
  info: ModelInfo,
  fields: string[],
):
  | { ok: true; values: Map<string, number> }
  | { ok: false; refusal: KvCacheRefusal } {
  const values = new Map<string, number>();

  for (const field of fields) {
    const value = usableField(info, field);

    if (value !== null) {
      values.set(field, value);
    }
  }

  if (values.size !== fields.length) {
    return {
      ok: false,
      refusal: refuse("missing-fields", {
        missingFields: fields.filter((field) => !values.has(field)),
      }),
    };
  }

  return { ok: true, values };
}

/**
 * MHA / GQA and MLA: one layer's cache repeated over every layer, growing with
 * every token.
 *
 * A checkpoint stating either latent width is describing MLA, so a half-stated
 * pair is refused by naming the absent half instead of falling through to the
 * head-based layout — that fallthrough is exactly the case that produces a
 * confident wrong answer. DeepSeek V4 does not reach here: it states a rope
 * width with no rank, and its compression schedule has already claimed it.
 */
function resolveUniform(info: ModelInfo, inputs: KvCacheInputs): ResolvedShape {
  const isLatent = LATENT_FIELDS.some(
    (field) => usableField(info, field) !== null,
  );
  const fields = [LAYERS_FIELD, ...(isLatent ? LATENT_FIELDS : HEAD_FIELDS)];
  const required = requireFields(info, fields);

  if (!required.ok) {
    return required;
  }

  const layers = valueFactor(
    factorFor(info, LAYERS_FIELD, required.values.get(LAYERS_FIELD) as number),
  );

  if (isLatent) {
    const terms = LATENT_FIELDS.map((field) =>
      factorFor(info, field, required.values.get(field) as number),
    );

    return {
      ok: true,
      family: "latent",
      familyBasis: "latent_widths",
      components: [
        {
          key: "full_kv",
          perToken: true,
          factors: [
            inputFactor(
              "tokens_per_sequence",
              inputs.tokensPerSequence ?? 0,
              inputs.tokensSource,
            ),
            layers,
            {
              kind: "sum",
              key: "latent_width",
              value: terms.reduce((sum, term) => sum + term.value, 0),
              terms,
            },
          ],
        },
      ],
    };
  }

  return {
    ok: true,
    family: "head",
    familyBasis: "uniform_layers",
    components: [
      {
        key: "full_kv",
        perToken: true,
        factors: [
          inputFactor(
              "tokens_per_sequence",
              inputs.tokensPerSequence ?? 0,
              inputs.tokensSource,
            ),
          layers,
          KEY_AND_VALUE,
          ...HEAD_FIELDS.map((field) =>
            valueFactor(
              factorFor(info, field, required.values.get(field) as number),
            ),
          ),
        ],
      },
    ],
  };
}

/**
 * Mixed full and sliding GQA (gpt-oss, Gemma, Cohere, Ministral).
 *
 * The two kinds of layer cache the same width per token and differ only in how
 * many tokens they keep: a full layer keeps all of them, a sliding layer keeps
 * at most its window. So the split is a layer count taken from layer_types and
 * the sliding term is capped by a min, which is what makes the total flatten out
 * once the sequence passes the window instead of continuing to climb.
 */
function resolveMixedFullSlidingGqa(
  info: ModelInfo,
  inputs: KvCacheInputs,
  kinds: string[],
): ResolvedShape {
  const unsupported = kinds.filter(
    (kind) =>
      !FULL_ATTENTION_LAYER_TYPES.includes(kind) &&
      kind !== SLIDING_ATTENTION_LAYER_TYPE,
  );

  if (unsupported.length > 0) {
    return {
      ok: false,
      refusal: refuse("layer-types", { layerTypes: unsupported }),
    };
  }

  const required = requireFields(info, [...HEAD_FIELDS, SLIDING_WINDOW_FIELD]);

  if (!required.ok) {
    return required;
  }

  const layerTypes = info.layer_types ?? [];
  const fullLayers = layerTypes.filter((kind) =>
    FULL_ATTENTION_LAYER_TYPES.includes(kind),
  ).length;
  const slidingLayers = layerTypes.filter(
    (kind) => kind === SLIDING_ATTENTION_LAYER_TYPE,
  ).length;

  const window = required.values.get(SLIDING_WINDOW_FIELD) as number;
  const tokens = inputs.tokensPerSequence ?? 0;
  const perLayerWidth = HEAD_FIELDS.map((field) =>
    valueFactor(factorFor(info, field, required.values.get(field) as number)),
  );

  const components: Omit<KvCacheComponent, "bytes">[] = [];

  if (fullLayers > 0) {
    components.push({
      key: "full_kv",
      perToken: true,
      factors: [
        inputFactor("tokens_per_sequence", tokens, inputs.tokensSource),
        countedFactor("full_attention_layers", fullLayers, "layer_types"),
        KEY_AND_VALUE,
        ...perLayerWidth,
      ],
    });
  }

  if (slidingLayers > 0) {
    components.push({
      key: "sliding_kv",
      perToken: false,
      factors: [
        {
          kind: "min",
          key: "cached_sliding_tokens",
          value: Math.min(tokens, window),
          terms: [
            {
              key: "tokens_per_sequence",
              value: tokens,
              source: inputs.tokensSource ?? "input",
            },
            factorFor(info, SLIDING_WINDOW_FIELD, window),
          ],
        },
        countedFactor("sliding_attention_layers", slidingLayers, "layer_types"),
        KEY_AND_VALUE,
        ...perLayerWidth,
      ],
    });
  }

  return {
    ok: true,
    family: "mixed_full_sliding_gqa",
    familyBasis: "sliding_layer_types",
    components,
  };
}

/**
 * Qwen linear/full hybrid (Qwen3.5 / 3.6 / 3.8).
 *
 * Only the full-attention layers hold a per-token KV cache. The linear layers
 * hold one fixed-size recurrent state per sequence instead, in two parts — a
 * short-convolution history and a per-head state matrix — and how many copies of
 * that state a sequence keeps is a serving decision, not a checkpoint fact, so
 * it comes in as an input.
 *
 * The draft term is the checkpoint's MTP module, whose attention is ordinary
 * full attention: Qwen3.6-27B's weight index holds one mtp.layers.0 block with a
 * self_attn, so it caches like one more full-attention layer and is counted as
 * mtp_num_layers of them.
 */
function resolveQwenLinearFullHybrid(
  info: ModelInfo,
  inputs: KvCacheInputs,
  kinds: string[],
): ResolvedShape {
  const unsupported = kinds.filter(
    (kind) =>
      !FULL_ATTENTION_LAYER_TYPES.includes(kind) &&
      kind !== LINEAR_ATTENTION_LAYER_TYPE,
  );

  if (unsupported.length > 0) {
    return {
      ok: false,
      refusal: refuse("layer-types", { layerTypes: unsupported }),
    };
  }

  const includeLinear = inputs.includeLinearState !== false;
  const fields = [...HEAD_FIELDS, ...(includeLinear ? LINEAR_FIELDS : [])];
  const required = requireFields(info, fields);

  if (!required.ok) {
    return required;
  }

  const layerTypes = info.layer_types ?? [];
  const fullLayers = layerTypes.filter((kind) =>
    FULL_ATTENTION_LAYER_TYPES.includes(kind),
  ).length;
  const linearLayers = layerTypes.filter(
    (kind) => kind === LINEAR_ATTENTION_LAYER_TYPE,
  ).length;

  const tokens = inputs.tokensPerSequence ?? 0;
  const perLayerWidth = HEAD_FIELDS.map((field) =>
    valueFactor(factorFor(info, field, required.values.get(field) as number)),
  );

  const components: Omit<KvCacheComponent, "bytes">[] = [];

  if (fullLayers > 0) {
    components.push({
      key: "full_kv",
      perToken: true,
      factors: [
        inputFactor("tokens_per_sequence", tokens, inputs.tokensSource),
        countedFactor("full_attention_layers", fullLayers, "layer_types"),
        KEY_AND_VALUE,
        ...perLayerWidth,
      ],
    });
  }

  if (includeLinear && linearLayers > 0) {
    const linearState = resolveLinearState(
      info,
      inputs,
      required.values,
      linearLayers,
      tokens,
    );

    if (!linearState.ok) {
      return linearState;
    }

    components.push(...linearState.components);
  }

  const draft = draftFullAttentionLayers(info, inputs);

  if (draft !== null) {
    components.push({
      key: "draft_kv",
      perToken: true,
      factors: [
        inputFactor("tokens_per_sequence", tokens, inputs.tokensSource),
        draft,
        KEY_AND_VALUE,
        ...perLayerWidth,
      ],
    });
  }

  return {
    ok: true,
    family: "qwen_linear_full_hybrid",
    familyBasis: "linear_layer_types",
    components,
  };
}

function resolveLinearState(
  info: ModelInfo,
  inputs: KvCacheInputs,
  values: Map<string, number>,
  linearLayers: number,
  tokens: number,
):
  | { ok: true; components: Omit<KvCacheComponent, "bytes">[] }
  | { ok: false; refusal: KvCacheRefusal } {
  const recurrentBytes = inputs.recurrentStateBytesPerElement;

  if (!isPositive(recurrentBytes ?? null)) {
    return { ok: false, refusal: refuse("invalid-input") };
  }

  const kernel = values.get("linear_conv_kernel_dim") as number;
  const keyHeads = values.get("linear_num_key_heads") as number;
  const keyDim = values.get("linear_key_head_dim") as number;
  const valueHeads = values.get("linear_num_value_heads") as number;
  const valueDim = values.get("linear_value_head_dim") as number;

  const retained = retainedCheckpoints(inputs.checkpointPolicy, tokens);

  if (retained === null) {
    return { ok: false, refusal: refuse("invalid-input") };
  }

  const layers = countedFactor(
    "linear_attention_layers",
    linearLayers,
    "layer_types",
  );
  const checkpoints = inputFactor("retained_states", retained);

  // The convolution buffers the queries, the keys and the values, so its width
  // is 2 x key heads x key dim (query and key share the key width) plus the
  // value side. Qwen3.6-27B's linear_attn.conv1d.weight is [10240, 1, 4], and
  // 2*16*128 + 48*128 = 10240 with a kernel of 4.
  const convWidth: KvCacheValue[] = [
    {
      key: "linear_num_key_heads",
      value: keyHeads,
      source: sourceOf(info, "linear_num_key_heads"),
    },
    {
      key: "linear_key_head_dim",
      value: keyDim,
      source: sourceOf(info, "linear_key_head_dim"),
    },
    {
      key: "linear_num_value_heads",
      value: valueHeads,
      source: sourceOf(info, "linear_num_value_heads"),
    },
    {
      key: "linear_value_head_dim",
      value: valueDim,
      source: sourceOf(info, "linear_value_head_dim"),
    },
  ];

  return {
    ok: true,
    components: [
      {
        key: "linear_conv_state",
        perToken: false,
        factors: [
          checkpoints,
          layers,
          {
            kind: "sum",
            key: "conv_history_steps",
            value: kernel - 1,
            terms: [
              factorFor(info, "linear_conv_kernel_dim", kernel),
              { key: "minus_the_current_step", value: -1, source: "constant" },
            ],
          },
          {
            kind: "sum",
            key: "conv_channels",
            value: 2 * keyHeads * keyDim + valueHeads * valueDim,
            terms: convWidth,
          },
          {
            kind: "value",
            key: "conv_state_bytes_per_element",
            value: LINEAR_CONV_STATE_BYTES,
            source: "unstated",
          },
        ],
      },
      {
        key: "linear_recurrent_state",
        perToken: false,
        factors: [
          checkpoints,
          layers,
          valueFactor(factorFor(info, "linear_num_value_heads", valueHeads)),
          valueFactor(factorFor(info, "linear_key_head_dim", keyDim)),
          valueFactor(factorFor(info, "linear_value_head_dim", valueDim)),
          inputFactor(
            "recurrent_state_bytes_per_element",
            recurrentBytes as number,
          ),
        ],
      },
    ],
  };
}

/**
 * DeepSeek V4 hybrid sparse attention.
 *
 * Every layer keeps a sliding window of the same width, whatever else it does.
 * On top of that, a layer with a positive compression rate keeps one compressed
 * slot per that many tokens, and a layer that indexes keeps an indexer entry per
 * slot. The result barely grows with the sequence — a rate of 128 turns 1M
 * tokens into 8192 slots — which is why applying the head formula to it
 * overstates the cache several times over.
 *
 * The schedule's surplus entries over num_hidden_layers are the draft modules,
 * one entry each, and they are appended to the active set only when draft KV is
 * asked for. That surplus is the only statement the checkpoint makes about how
 * many draft modules it holds: DeepSeek-V4-Pro-0813 states
 * num_nextn_predict_layers 1 and carries three mtp.N modules, matching its three
 * surplus entries.
 */
function resolveDeepseekV4(
  info: ModelInfo,
  inputs: KvCacheInputs,
  kinds: string[],
): ResolvedShape {
  const unsupported = kinds.filter(
    (kind) => !FULL_ATTENTION_LAYER_TYPES.includes(kind),
  );

  if (unsupported.length > 0) {
    return {
      ok: false,
      refusal: refuse("layer-types", { layerTypes: unsupported }),
    };
  }

  const schedule = info.compress_ratios ?? [];
  const unverified = [...new Set(schedule)].filter(
    (rate) => !VERIFIED_COMPRESS_RATES.includes(rate),
  );

  if (unverified.length > 0) {
    return {
      ok: false,
      refusal: refuse("compression-rates", { compressionRates: unverified }),
    };
  }

  const indexes = schedule.includes(INDEXING_COMPRESS_RATE);
  const required = requireFields(info, [
    LAYERS_FIELD,
    ...HEAD_FIELDS,
    SLIDING_WINDOW_FIELD,
    ...(indexes ? [INDEX_HEAD_DIM_FIELD] : []),
  ]);

  if (!required.ok) {
    return required;
  }

  const layers = required.values.get(LAYERS_FIELD) as number;
  const active = inputs.includeDraftKvCache
    ? schedule
    : schedule.slice(0, layers);
  const tokens = inputs.tokensPerSequence ?? 0;
  const window = required.values.get(SLIDING_WINDOW_FIELD) as number;
  const perLayerWidth = HEAD_FIELDS.map((field) =>
    valueFactor(factorFor(info, field, required.values.get(field) as number)),
  );

  const compressedSlots = active.reduce(
    (sum, rate) => (rate > 0 ? sum + Math.floor(tokens / rate) : sum),
    0,
  );
  const indexedSlots = active.reduce(
    (sum, rate) =>
      rate === INDEXING_COMPRESS_RATE
        ? sum + Math.floor(tokens / INDEXING_COMPRESS_RATE)
        : sum,
    0,
  );

  const components: Omit<KvCacheComponent, "bytes">[] = [
    {
      // Every active layer keeps its window, the rate-0 ones included: that is
      // the whole of their cache, not an addition to it.
      key: "sliding_kv",
      perToken: false,
      factors: [
        countedFactor("active_layers", active.length, "compress_ratios"),
        valueFactor(factorFor(info, SLIDING_WINDOW_FIELD, window)),
        ...perLayerWidth,
      ],
    },
  ];

  if (compressedSlots > 0) {
    components.push({
      key: "compressed_kv",
      perToken: false,
      factors: [
        countedFactor("compressed_slots", compressedSlots, "compress_ratios"),
        ...perLayerWidth,
      ],
    });
  }

  if (indexes && indexedSlots > 0) {
    const indexerBytes = inputs.indexerBytesPerElement;

    if (!isPositive(indexerBytes ?? null)) {
      return { ok: false, refusal: refuse("invalid-input") };
    }

    components.push({
      key: "indexer",
      perToken: false,
      factors: [
        countedFactor("indexed_slots", indexedSlots, "compress_ratios"),
        valueFactor(
          factorFor(
            info,
            INDEX_HEAD_DIM_FIELD,
            required.values.get(INDEX_HEAD_DIM_FIELD) as number,
          ),
        ),
        inputFactor("indexer_bytes_per_element", indexerBytes as number),
      ],
    });
  }

  return {
    ok: true,
    family: "deepseek_v4_hybrid",
    familyBasis: "compress_ratios",
    components,
  };
}

/**
 * The draft modules' worth of ordinary full-attention layers, or null when the
 * caller did not ask for them or the checkpoint states none.
 */
function draftFullAttentionLayers(
  info: ModelInfo,
  inputs: KvCacheInputs,
): KvCacheFactor | null {
  if (!inputs.includeDraftKvCache) {
    return null;
  }

  const layers = usableField(info, MTP_LAYERS_FIELD);

  if (layers === null) {
    return null;
  }

  return valueFactor(factorFor(info, MTP_LAYERS_FIELD, layers));
}

/**
 * How many linear-attention states a sequence retains under the chosen policy.
 * Prompt-end keeps the one state that resuming needs; a fixed interval keeps one
 * per interval plus the final partial one.
 */
function retainedCheckpoints(
  policy: LinearStateCheckpointPolicy | undefined,
  tokens: number,
): number | null {
  if (!policy || policy.kind === "prompt-end") {
    return 1;
  }

  const interval = policy.tokens;

  if (!isPositive(interval) || !Number.isInteger(interval)) {
    return null;
  }

  return Math.max(1, Math.ceil(tokens / interval));
}

function sourceOf(info: ModelInfo, field: string): KvCacheSource {
  return modelFieldSource(info, field) ?? "unstated";
}

function isPositive(value: number | null | undefined): value is number {
  return (
    value !== null && value !== undefined && Number.isFinite(value) && value > 0
  );
}
