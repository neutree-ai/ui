import { describe, expect, it } from "vitest";
import {
  defaultRecurrentStatePrecisionId,
  estimateKvCache,
  type KvCacheComponentKey,
  type KvCacheEstimate,
  type KvCacheInputs,
} from "@/foundation/lib/kv-cache";
import type { ModelInfo } from "@/foundation/types/serving-types";

/**
 * The hybrid cache layouts, against the checkpoints that motivated them.
 *
 * Every model below is transcribed from the config.json a user would actually
 * deploy — Qwen3.6 and Qwen3.8 from their text_config sections, DeepSeek V4 from
 * its flat top level. A synthetic shape would let a formula agree with a test
 * that made the same mistake, and these formulas exist precisely because the
 * obvious one is wrong on these models.
 *
 * Each family therefore also pins what the head-based formula would have said,
 * so the reason this code exists stays measurable rather than remembered.
 */

/** openai/gpt-oss-20b — 12 sliding and 12 full layers, 128-token window. */
const gptOss20b: ModelInfo = {
  architecture: "GptOssForCausalLM",
  num_hidden_layers: 24,
  num_attention_heads: 64,
  num_key_value_heads: 8,
  head_dim: 64,
  layer_types: Array.from({ length: 12 }, () => [
    "sliding_attention",
    "full_attention",
  ]).flat(),
  sliding_window: 128,
  max_position_embeddings: 131072,
  parameter_dtype: "bfloat16",
  field_sources: {
    num_hidden_layers: "auto",
    num_key_value_heads: "auto",
    head_dim: "auto",
    layer_types: "auto",
    sliding_window: "auto",
    parameter_dtype: "auto",
  },
};

/** The linear/full alternation Qwen3.5-generation configs state: three linear
 * layers to every full one, which full_attention_interval 4 also says. */
const qwenLayerTypes = (layers: number): string[] =>
  Array.from({ length: layers }, (_, index) =>
    (index + 1) % 4 === 0 ? "full_attention" : "linear_attention",
  );

/** Qwen/Qwen3.6-27B — 64 layers, 16 of them full attention. */
const qwen36_27b: ModelInfo = {
  architecture: "Qwen3_5ForConditionalGeneration",
  num_hidden_layers: 64,
  num_attention_heads: 24,
  num_key_value_heads: 4,
  head_dim: 256,
  layer_types: qwenLayerTypes(64),
  linear_conv_kernel_dim: 4,
  linear_num_key_heads: 16,
  linear_key_head_dim: 128,
  linear_num_value_heads: 48,
  linear_value_head_dim: 128,
  recurrent_state_dtype: "float32",
  mtp_num_layers: 1,
  max_position_embeddings: 262144,
  parameter_dtype: "bfloat16",
  field_sources: {
    num_hidden_layers: "auto",
    num_key_value_heads: "auto",
    head_dim: "auto",
    layer_types: "auto",
    linear_conv_kernel_dim: "auto",
    linear_num_key_heads: "auto",
    linear_key_head_dim: "auto",
    linear_num_value_heads: "auto",
    linear_value_head_dim: "auto",
    recurrent_state_dtype: "auto",
    mtp_num_layers: "auto",
    parameter_dtype: "auto",
  },
};

/** Qwen/Qwen3.6-35B-A3B — 40 layers, 10 full, narrower everywhere. */
const qwen36_35bA3b: ModelInfo = {
  ...qwen36_27b,
  architecture: "Qwen3_5MoeForConditionalGeneration",
  num_hidden_layers: 40,
  num_attention_heads: 16,
  num_key_value_heads: 2,
  layer_types: qwenLayerTypes(40),
  linear_num_value_heads: 32,
  is_moe: true,
  num_experts: 256,
};

/** Qwen/Qwen3.8-27B — the same shape as Qwen3.6-27B, a later transformers. */
const qwen38_27b: ModelInfo = { ...qwen36_27b };

/**
 * The DeepSeek V4 schedules, verbatim. Two rates alternate from the third layer
 * on; the head of the array differs between the two checkpoints, and the tail of
 * three zeros is the three draft modules each of them carries.
 */
const v4Schedule = (leading: number[], pairs: number): number[] => [
  ...leading,
  ...Array.from({ length: pairs }, () => [4, 128]).flat(),
  // The last layer is a rate-4 one, so the alternation ends unpaired.
  4,
  // One entry per draft module. Both checkpoints carry three.
  0,
  0,
  0,
];

/** deepseek-ai/DeepSeek-V4-Pro-0813 — 61 layers: 128,128 then 4,128 alternating
 * to a final 4, plus three draft entries. */
const deepseekV4Pro: ModelInfo = {
  architecture: "DeepseekV4ForCausalLM",
  num_hidden_layers: 61,
  num_attention_heads: 128,
  num_key_value_heads: 1,
  head_dim: 512,
  qk_rope_head_dim: 64,
  sliding_window: 128,
  compress_ratios: v4Schedule([128, 128], 29),
  index_n_heads: 64,
  index_head_dim: 128,
  index_topk: 1024,
  mtp_num_layers: 1,
  max_position_embeddings: 1048576,
  parameter_dtype: "bfloat16",
  quantization_bits: 8,
  field_sources: {
    num_hidden_layers: "auto",
    num_key_value_heads: "auto",
    head_dim: "auto",
    qk_rope_head_dim: "auto",
    sliding_window: "auto",
    compress_ratios: "auto",
    index_head_dim: "auto",
    mtp_num_layers: "auto",
    parameter_dtype: "auto",
  },
};

/** deepseek-ai/DeepSeek-V4-Flash-0731 — 43 layers opening with two rate-0 ones. */
const deepseekV4Flash: ModelInfo = {
  ...deepseekV4Pro,
  num_hidden_layers: 43,
  num_attention_heads: 64,
  compress_ratios: v4Schedule([0, 0], 20),
  index_topk: 512,
};

const ok = (result: ReturnType<typeof estimateKvCache>): KvCacheEstimate => {
  if (!result.ok) {
    throw new Error(`expected an estimate, got refusal: ${result.reason}`);
  }

  return result;
};

const bytesOf = (estimate: KvCacheEstimate, key: KvCacheComponentKey): number =>
  estimate.components.find((component) => component.key === key)?.bytes ?? 0;

const componentKeys = (estimate: KvCacheEstimate): KvCacheComponentKey[] =>
  estimate.components.map((component) => component.key);

/** A factor's value wherever it appears, so a formula row can be checked
 * without depending on which component it landed in. */
const factorValue = (estimate: KvCacheEstimate, key: string): number => {
  for (const component of estimate.components) {
    const found = component.factors.find((factor) => factor.key === key);

    if (found) {
      return found.value;
    }
  }

  throw new Error(`no factor named ${key}`);
};

const estimateFor = (inputs: KvCacheInputs) => ok(estimateKvCache(inputs));

describe("the schedules are transcribed as the checkpoints state them", () => {
  it("matches DeepSeek V4's published rate counts and array lengths", () => {
    // Pro: 61 layers as 31 rate-128 and 30 rate-4, plus three draft entries.
    const pro = deepseekV4Pro.compress_ratios as number[];

    expect(pro).toHaveLength(64);
    expect(pro.filter((rate) => rate === 128)).toHaveLength(31);
    expect(pro.filter((rate) => rate === 4)).toHaveLength(30);
    expect(pro.slice(61)).toEqual([0, 0, 0]);

    // Flash: 43 layers as 2 rate-0, 20 rate-128 and 21 rate-4, plus three.
    const flash = deepseekV4Flash.compress_ratios as number[];

    expect(flash).toHaveLength(46);
    expect(flash.slice(0, 2)).toEqual([0, 0]);
    expect(flash.filter((rate) => rate === 128)).toHaveLength(20);
    expect(flash.filter((rate) => rate === 4)).toHaveLength(21);
    expect(flash.slice(43)).toEqual([0, 0, 0]);
  });

  it("matches the Qwen layer split the configs state", () => {
    const types = qwen36_27b.layer_types as string[];

    expect(types).toHaveLength(64);
    expect(types.filter((kind) => kind === "full_attention")).toHaveLength(16);
    expect(types.filter((kind) => kind === "linear_attention")).toHaveLength(
      48,
    );
    expect(
      (qwen36_35bA3b.layer_types as string[]).filter(
        (kind) => kind === "full_attention",
      ),
    ).toHaveLength(10);
  });
});

describe("mixed full/sliding GQA", () => {
  it("caps the sliding layers at their window and keeps the full ones linear", () => {
    const estimate = estimateFor({
      info: gptOss20b,
      tokensPerSequence: 4096,
      sequences: 1,
      bytesPerElement: 2,
    });

    expect(estimate.family).toBe("mixed_full_sliding_gqa");
    expect(estimate.familyBasis).toBe("sliding_layer_types");
    expect(componentKeys(estimate)).toEqual(["full_kv", "sliding_kv"]);

    // 4096 tokens × 12 full layers × 2 × 8 KV heads × 64 head_dim × 2 bytes.
    expect(bytesOf(estimate, "full_kv")).toBe(4096 * 12 * 2 * 8 * 64 * 2);
    // min(4096, 128) × 12 sliding layers × 2 × 8 × 64 × 2.
    expect(bytesOf(estimate, "sliding_kv")).toBe(128 * 12 * 2 * 8 * 64 * 2);
    expect(estimate.totalBytes).toBe(103_809_024);

    // The layer split is counted out of layer_types and says so.
    expect(factorValue(estimate, "full_attention_layers")).toBe(12);
    expect(factorValue(estimate, "sliding_attention_layers")).toBe(12);
    expect(factorValue(estimate, "cached_sliding_tokens")).toBe(128);
  });

  it("stops growing once the sequence passes the window", () => {
    const shorter = estimateFor({
      info: gptOss20b,
      tokensPerSequence: 4096,
      sequences: 1,
      bytesPerElement: 2,
    });
    const longer = estimateFor({
      info: gptOss20b,
      tokensPerSequence: 8192,
      sequences: 1,
      bytesPerElement: 2,
    });

    // The full layers double; the sliding ones do not move at all. A formula
    // that treated every layer alike would double both.
    expect(bytesOf(longer, "full_kv")).toBe(bytesOf(shorter, "full_kv") * 2);
    expect(bytesOf(longer, "sliding_kv")).toBe(bytesOf(shorter, "sliding_kv"));
    expect(longer.uniformlyPerToken).toBe(false);
  });

  it("is a little under half what the head formula would have said", () => {
    const estimate = estimateFor({
      info: gptOss20b,
      tokensPerSequence: 4096,
      sequences: 1,
      bytesPerElement: 2,
    });

    // All 24 layers charged for all 4096 tokens.
    const headBased = 4096 * 24 * 2 * 8 * 64 * 2;

    expect(headBased).toBe(201_326_592);
    expect(headBased / estimate.totalBytes).toBeCloseTo(1.94, 2);
  });

  it("refuses a windowed checkpoint that does not state its window", () => {
    const result = estimateKvCache({
      info: { ...gptOss20b, sliding_window: undefined },
      tokensPerSequence: 4096,
      sequences: 1,
      bytesPerElement: 2,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "missing-fields",
      missingFields: ["sliding_window"],
    });
  });
});

describe("Qwen linear/full hybrid", () => {
  const inputs = {
    tokensPerSequence: 8192,
    sequences: 1,
    bytesPerElement: 2,
    recurrentStateBytesPerElement: 4,
  } as const;

  it("charges only the full-attention layers per token", () => {
    const estimate = estimateFor({ info: qwen36_27b, ...inputs });

    expect(estimate.family).toBe("qwen_linear_full_hybrid");
    expect(estimate.familyBasis).toBe("linear_layer_types");

    // 8192 tokens × 16 full layers × 2 × 4 KV heads × 256 head_dim × 2 bytes.
    expect(bytesOf(estimate, "full_kv")).toBe(8192 * 16 * 2 * 4 * 256 * 2);
    expect(factorValue(estimate, "full_attention_layers")).toBe(16);
    expect(factorValue(estimate, "linear_attention_layers")).toBe(48);
  });

  it("adds the recurrent state the checkpoint's own widths give", () => {
    const estimate = estimateFor({ info: qwen36_27b, ...inputs });

    // The convolution buffers queries, keys and values:
    // 2 × 16 key heads × 128 + 48 value heads × 128 = 10240 channels, which is
    // exactly the width of Qwen3.6-27B's linear_attn.conv1d.weight.
    expect(factorValue(estimate, "conv_channels")).toBe(10_240);
    // 48 linear layers × (4 − 1) steps × 10240 channels × 2 bytes.
    expect(bytesOf(estimate, "linear_conv_state")).toBe(48 * 3 * 10_240 * 2);
    // 48 layers × 48 value heads × 128 × 128 × 4 bytes of float32 state.
    expect(bytesOf(estimate, "linear_recurrent_state")).toBe(
      48 * 48 * 128 * 128 * 4,
    );
    expect(estimate.totalBytes).toBe(690_814_976);
  });

  it("holds the recurrent state flat as the sequence grows", () => {
    const shorter = estimateFor({ info: qwen36_27b, ...inputs });
    const longer = estimateFor({
      info: qwen36_27b,
      ...inputs,
      tokensPerSequence: 65_536,
    });

    expect(bytesOf(longer, "linear_recurrent_state")).toBe(
      bytesOf(shorter, "linear_recurrent_state"),
    );
    expect(bytesOf(longer, "full_kv")).toBe(bytesOf(shorter, "full_kv") * 8);
  });

  it("charges every layer four times over if the head formula is used", () => {
    const estimate = estimateFor({ info: qwen36_27b, ...inputs });

    // All 64 layers as token-linear KV — four times the 16 that are, and it
    // still misses the 144 MiB of recurrent state that is really there.
    const headBased = 8192 * 64 * 2 * 4 * 256 * 2;

    expect(headBased).toBe(2_147_483_648);
    expect(headBased / bytesOf(estimate, "full_kv")).toBe(4);
    expect(bytesOf(estimate, "linear_recurrent_state") / 1024 ** 2).toBe(144);
  });

  it("scales the state with a fixed checkpoint interval", () => {
    const promptEnd = estimateFor({ info: qwen36_27b, ...inputs });
    const every2k = estimateFor({
      info: qwen36_27b,
      ...inputs,
      checkpointPolicy: { kind: "fixed-interval", tokens: 2048 },
    });

    // 8192 tokens at one state every 2048 is four retained states.
    expect(factorValue(every2k, "retained_states")).toBe(4);
    expect(factorValue(promptEnd, "retained_states")).toBe(1);
    expect(bytesOf(every2k, "linear_recurrent_state")).toBe(
      bytesOf(promptEnd, "linear_recurrent_state") * 4,
    );

    // A partial final interval still costs a whole state.
    const uneven = estimateFor({
      info: qwen36_27b,
      ...inputs,
      tokensPerSequence: 5000,
      checkpointPolicy: { kind: "fixed-interval", tokens: 2048 },
    });

    expect(factorValue(uneven, "retained_states")).toBe(3);
  });

  it("drops the state entirely when the deployment does not retain it", () => {
    const estimate = estimateFor({
      info: qwen36_27b,
      ...inputs,
      includeLinearState: false,
    });

    expect(componentKeys(estimate)).toEqual(["full_kv"]);
  });

  it("adds the draft module's KV only when asked, at the stated layer count", () => {
    const without = estimateFor({ info: qwen36_27b, ...inputs });
    const with_ = estimateFor({
      info: qwen36_27b,
      ...inputs,
      includeDraftKvCache: true,
    });

    expect(componentKeys(without)).not.toContain("draft_kv");
    // Qwen3.6-27B's weight index holds one mtp.layers.0 block with a self_attn,
    // so the draft module caches like one more full-attention layer.
    expect(bytesOf(with_, "draft_kv")).toBe(8192 * 1 * 2 * 4 * 256 * 2);
    expect(bytesOf(with_, "draft_kv")).toBe(bytesOf(without, "full_kv") / 16);
  });

  it("computes the narrower 35B-A3B shape from its own widths", () => {
    const estimate = estimateFor({ info: qwen36_35bA3b, ...inputs });

    expect(factorValue(estimate, "full_attention_layers")).toBe(10);
    expect(factorValue(estimate, "linear_attention_layers")).toBe(30);
    // 2 × 16 × 128 + 32 × 128 = 8192 channels, narrower than the 27B's 10240.
    expect(factorValue(estimate, "conv_channels")).toBe(8_192);
    expect(bytesOf(estimate, "full_kv")).toBe(8192 * 10 * 2 * 2 * 256 * 2);
    expect(bytesOf(estimate, "linear_recurrent_state")).toBe(
      30 * 32 * 128 * 128 * 4,
    );
    expect(estimate.totalBytes).toBe(232_161_280);
  });

  it("computes Qwen3.8-27B the same way, from the same stated widths", () => {
    const v38 = estimateFor({ info: qwen38_27b, ...inputs });
    const v36 = estimateFor({ info: qwen36_27b, ...inputs });

    expect(v38.family).toBe("qwen_linear_full_hybrid");
    expect(v38.totalBytes).toBe(v36.totalBytes);
  });

  it("defaults the state precision to the dtype the checkpoint states for it", () => {
    // float32 state on a bfloat16 checkpoint: the weight dtype is not a stand-in.
    expect(defaultRecurrentStatePrecisionId(qwen36_27b)).toBe("fp32");
    expect(
      defaultRecurrentStatePrecisionId({
        ...qwen36_27b,
        recurrent_state_dtype: undefined,
      }),
    ).toBeNull();
  });

  it("refuses a linear checkpoint that leaves one of the widths out", () => {
    const result = estimateKvCache({
      info: { ...qwen36_27b, linear_key_head_dim: undefined },
      ...inputs,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "missing-fields",
      missingFields: ["linear_key_head_dim"],
    });
  });
});

describe("DeepSeek V4 hybrid sparse attention", () => {
  const inputs = {
    tokensPerSequence: 1024,
    sequences: 1,
    bytesPerElement: 1,
    indexerBytesPerElement: 0.5,
  } as const;

  it("is chosen off the compression schedule, not off the rope width", () => {
    const estimate = estimateFor({ info: deepseekV4Pro, ...inputs });

    expect(estimate.family).toBe("deepseek_v4_hybrid");
    expect(estimate.familyBasis).toBe("compress_ratios");
  });

  it("keeps a window on every layer plus one slot per compression rate", () => {
    const estimate = estimateFor({ info: deepseekV4Pro, ...inputs });

    expect(componentKeys(estimate)).toEqual([
      "sliding_kv",
      "compressed_kv",
      "indexer",
    ]);

    // 61 layers × 128 window × 1 KV head × 512 head_dim × 1 byte.
    expect(factorValue(estimate, "active_layers")).toBe(61);
    expect(bytesOf(estimate, "sliding_kv")).toBe(61 * 128 * 1 * 512 * 1);

    // 31 layers at floor(1024/128)=8 slots and 30 at floor(1024/4)=256:
    // 31×8 + 30×256 = 7928 slots, each 512 wide.
    expect(factorValue(estimate, "compressed_slots")).toBe(7_928);
    expect(bytesOf(estimate, "compressed_kv")).toBe(7_928 * 1 * 512 * 1);

    // Only the rate-4 layers index: 30 × 256 = 7680 entries of 128 at 0.5 bytes.
    expect(factorValue(estimate, "indexed_slots")).toBe(7_680);
    expect(bytesOf(estimate, "indexer")).toBe(7_680 * 128 * 0.5);

    expect(estimate.totalBytes).toBe(8_548_352);
  });

  it("costs a seventh of what the head formula would have said", () => {
    const estimate = estimateFor({ info: deepseekV4Pro, ...inputs });

    // 61 layers × 2 × 1 KV head × 512 head_dim × 1024 tokens × 1 byte. It is a
    // plausible number and it is wrong: V4 caches one latent per compressed
    // slot, not a key and a value per token.
    const headBased = 1024 * 61 * 2 * 1 * 512 * 1;

    expect(headBased).toBe(63_963_136);
    expect(headBased / estimate.totalBytes).toBeCloseTo(7.48, 2);
  });

  it("does not add the rope width to head_dim the way V3's latent does", () => {
    const estimate = estimateFor({ info: deepseekV4Pro, ...inputs });

    // V4's attn.wkv.weight has 512 output rows and attn.kv_norm.weight is 512
    // wide, so qk_rope_head_dim names a rotary slice inside head_dim rather than
    // a second width beside it. The checkpoint states both, and reading it the
    // way DeepSeek V3 is read — kv_lora_rank + qk_rope_head_dim — would widen
    // every cached element from 512 to 576.
    expect(factorValue(estimate, "head_dim")).toBe(512);

    const asIfLatent = (512 + 64) / 512;

    expect(estimate.totalBytes * asIfLatent).toBeCloseTo(9_616_896, 0);
    expect(estimate.totalBytes).toBeLessThan(9_616_896);

    // And no latent width reaches the arithmetic, since none is stated.
    expect(
      estimate.components.every((component) =>
        component.factors.every((factor) => factor.key !== "kv_lora_rank"),
      ),
    ).toBe(true);
  });

  it("counts the draft entries only when draft KV is asked for", () => {
    const base = estimateFor({ info: deepseekV4Pro, ...inputs });
    const drafted = estimateFor({
      info: deepseekV4Pro,
      ...inputs,
      includeDraftKvCache: true,
    });

    // The three surplus schedule entries are the three mtp.N modules the weight
    // index holds — num_nextn_predict_layers says 1, which is layers per module.
    expect(factorValue(drafted, "active_layers")).toBe(64);
    // Their rate is 0, so they add a window each and nothing else.
    expect(bytesOf(drafted, "sliding_kv") - bytesOf(base, "sliding_kv")).toBe(
      3 * 128 * 1 * 512 * 1,
    );
    expect(bytesOf(drafted, "compressed_kv")).toBe(
      bytesOf(base, "compressed_kv"),
    );
    expect(bytesOf(drafted, "indexer")).toBe(bytesOf(base, "indexer"));
    expect(drafted.totalBytes).toBe(8_744_960);
  });

  it("charges a rate-0 layer its window and nothing more", () => {
    const estimate = estimateFor({ info: deepseekV4Flash, ...inputs });

    // Flash opens with two rate-0 layers, which carry neither a compressor nor
    // an indexer in its weight index.
    expect(factorValue(estimate, "active_layers")).toBe(43);
    expect(bytesOf(estimate, "sliding_kv")).toBe(43 * 128 * 1 * 512 * 1);
    // 20 × 8 + 21 × 256 = 5536 slots.
    expect(factorValue(estimate, "compressed_slots")).toBe(5_536);
    expect(factorValue(estimate, "indexed_slots")).toBe(21 * 256);
    expect(estimate.totalBytes).toBe(5_996_544);

    const headBased = 1024 * 43 * 2 * 1 * 512 * 1;

    expect(headBased).toBe(45_088_768);
    expect(headBased / estimate.totalBytes).toBeGreaterThan(7);
  });

  it("barely grows with the sequence, which is the point of the layout", () => {
    const short = estimateFor({ info: deepseekV4Pro, ...inputs });
    const long = estimateFor({
      info: deepseekV4Pro,
      ...inputs,
      tokensPerSequence: 1_048_576,
    });

    // A thousandfold longer sequence for well under a thousandfold cache.
    expect(long.totalBytes / short.totalBytes).toBeLessThan(700);
    expect(bytesOf(long, "sliding_kv")).toBe(bytesOf(short, "sliding_kv"));
  });

  it("refuses a rate it has no evidence for rather than guessing", () => {
    const result = estimateKvCache({
      info: {
        ...deepseekV4Pro,
        compress_ratios: [128, 8, 128, 8],
        num_hidden_layers: 4,
      },
      ...inputs,
    });

    // 8 is not one of the rates the released checkpoints use, so nothing
    // establishes whether such a layer carries an indexer. A number here would
    // be a guess wearing the same typeface as a computed one.
    expect(result).toMatchObject({
      ok: false,
      reason: "compression-rates",
      compressionRates: [8],
    });
  });

  it("refuses an indexing schedule with no indexer width", () => {
    const result = estimateKvCache({
      info: { ...deepseekV4Pro, index_head_dim: undefined },
      ...inputs,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "missing-fields",
      missingFields: ["index_head_dim"],
    });
  });
});
