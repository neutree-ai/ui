import { describe, expect, it } from "vitest";
import {
  BYTES_PER_GB,
  defaultPrecisionId,
  estimateKvCache,
  type KvCacheEstimate,
  type KvCacheFactor,
} from "@/foundation/lib/kv-cache";
import type { ModelInfo } from "@/foundation/types/serving-types";

/**
 * Every checkpoint below is a real config.json, transcribed with the values it
 * actually states. A synthetic shape would let the formulas agree with a test
 * that made the same mistake; these are the models a user deploys.
 */

/** Qwen/Qwen2-7B-Instruct — GQA, head_dim derived from hidden_size / heads. */
const qwen2: ModelInfo = {
  architecture: "Qwen2ForCausalLM",
  num_hidden_layers: 28,
  num_attention_heads: 28,
  num_key_value_heads: 4,
  head_dim: 128,
  max_position_embeddings: 131072,
  parameter_dtype: "bfloat16",
  field_sources: {
    num_hidden_layers: "auto",
    num_attention_heads: "auto",
    num_key_value_heads: "auto",
    head_dim: "derived",
    max_position_embeddings: "auto",
    parameter_dtype: "auto",
  },
};

/** deepseek-ai/DeepSeek-V3 — MLA. It states the head-based fields too. */
const deepseekV3: ModelInfo = {
  architecture: "DeepseekV3ForCausalLM",
  num_hidden_layers: 61,
  num_attention_heads: 128,
  num_key_value_heads: 128,
  head_dim: 56,
  kv_lora_rank: 512,
  qk_rope_head_dim: 64,
  max_position_embeddings: 163840,
  parameter_dtype: "bfloat16",
  field_sources: {
    num_hidden_layers: "auto",
    num_key_value_heads: "auto",
    head_dim: "derived",
    kv_lora_rank: "auto",
    qk_rope_head_dim: "auto",
    parameter_dtype: "auto",
  },
};

/** openai/gpt-oss-20b — alternating sliding and full attention layers. */
const gptOss: ModelInfo = {
  architecture: "GptOssForCausalLM",
  num_hidden_layers: 24,
  num_key_value_heads: 8,
  head_dim: 64,
  layer_types: Array.from({ length: 12 }, () => [
    "sliding_attention",
    "full_attention",
  ]).flat(),
  max_position_embeddings: 131072,
  parameter_dtype: "bfloat16",
};

const ok = (result: ReturnType<typeof estimateKvCache>): KvCacheEstimate => {
  if (!result.ok) {
    throw new Error(`expected an estimate, got refusal: ${result.reason}`);
  }

  return result;
};

/** The formula rows of an estimate that has exactly one component, which is
 * every estimate in this file: the uniform layouts are one product. */
const factor = (estimate: KvCacheEstimate, key: string): KvCacheFactor => {
  const [component, ...rest] = estimate.components;

  if (!component || rest.length > 0) {
    throw new Error(
      `expected one component, got ${estimate.components.length}`,
    );
  }

  const found = component.factors.find((entry) => entry.key === key);

  if (!found) {
    throw new Error(`no factor named ${key}`);
  }

  return found;
};

describe("estimateKvCache", () => {
  it("multiplies the head-based formula out for a GQA checkpoint", () => {
    const estimate = ok(
      estimateKvCache({
        info: qwen2,
        tokensPerSequence: 4096,
        sequences: 2,
        bytesPerElement: 2,
      }),
    );

    // 28 layers × 2 × 4 KV heads × 128 head_dim × 2 bytes.
    expect(estimate.family).toBe("head");
    expect(estimate.bytesPerToken).toBe(57344);
    expect(estimate.totalBytes).toBe(57344 * 4096 * 2);
    expect(estimate.totalGb).toBeCloseTo(0.4375, 6);
  });

  it("uses the latent widths for an MLA checkpoint, not its KV heads", () => {
    const estimate = ok(
      estimateKvCache({
        info: deepseekV3,
        tokensPerSequence: 8192,
        sequences: 1,
        bytesPerElement: 2,
      }),
    );

    // 61 layers × (512 + 64) × 2 bytes.
    expect(estimate.family).toBe("latent");
    expect(estimate.bytesPerToken).toBe(70272);
    expect(estimate.totalBytes).toBe(70272 * 8192);
    expect(estimate.totalGb).toBeCloseTo((70272 * 8192) / BYTES_PER_GB, 6);

    // The trap this exists to avoid: DeepSeek states 128 KV heads and a 56-wide
    // head, and reading the cache off those over-states it 24-fold.
    const headBased = 61 * 2 * 128 * 56 * 2;
    expect(headBased / estimate.bytesPerToken).toBeGreaterThan(20);
  });

  it("keeps each value's provenance on the factor it contributes", () => {
    const estimate = ok(
      estimateKvCache({
        info: qwen2,
        tokensPerSequence: 1024,
        sequences: 1,
        bytesPerElement: 2,
      }),
    );

    expect(factor(estimate, "head_dim")).toMatchObject({
      value: 128,
      source: "derived",
    });
    expect(factor(estimate, "num_key_value_heads")).toMatchObject({
      source: "auto",
    });
    expect(factor(estimate, "key_and_value")).toMatchObject({
      value: 2,
      source: "constant",
    });
    expect(factor(estimate, "tokens_per_sequence")).toMatchObject({
      value: 1024,
      source: "input",
    });
  });

  it("reports a catalog value that states no provenance as unstated", () => {
    const estimate = ok(
      estimateKvCache({
        info: { num_hidden_layers: 32, num_key_value_heads: 8, head_dim: 128 },
        tokensPerSequence: 1024,
        sequences: 1,
        bytesPerElement: 2,
      }),
    );

    expect(factor(estimate, "num_hidden_layers")).toMatchObject({
      source: "unstated",
    });
  });

  it("adds the latent widths before multiplying, and says so in the factors", () => {
    const estimate = ok(
      estimateKvCache({
        info: deepseekV3,
        tokensPerSequence: 1,
        sequences: 1,
        bytesPerElement: 1,
      }),
    );

    expect(factor(estimate, "latent_width")).toMatchObject({
      kind: "sum",
      value: 576,
      terms: [
        { key: "kv_lora_rank", value: 512, source: "auto" },
        { key: "qk_rope_head_dim", value: 64, source: "auto" },
      ],
    });
  });

  it("refuses a checkpoint that states one latent width and not the other", () => {
    // The regression this guards: falling back to the head-based formula here
    // produces a number, and the number is wrong by more than an order of
    // magnitude.
    const result = estimateKvCache({
      info: { ...deepseekV3, qk_rope_head_dim: undefined },
      tokensPerSequence: 8192,
      sequences: 1,
      bytesPerElement: 2,
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      reason: "missing-fields",
      missingFields: ["qk_rope_head_dim"],
    });
  });

  it("names every field it would have needed", () => {
    const result = estimateKvCache({
      info: { num_hidden_layers: 32, num_attention_heads: 32 },
      tokensPerSequence: 4096,
      sequences: 1,
      bytesPerElement: 2,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "missing-fields",
      missingFields: ["num_key_value_heads", "head_dim"],
    });
  });

  it("treats an unusable value as a field it does not have", () => {
    const result = estimateKvCache({
      info: { ...qwen2, num_hidden_layers: 0 },
      tokensPerSequence: 4096,
      sequences: 1,
      bytesPerElement: 2,
    });

    expect(result).toMatchObject({
      ok: false,
      missingFields: ["num_hidden_layers"],
    });
  });

  it("refuses a checkpoint whose layers do not all cache alike", () => {
    // gpt-oss states a window, so it now has a formula. Take the window away
    // and the same layout becomes undescribable again.
    const result = estimateKvCache({
      info: { ...gptOss, sliding_window: undefined },
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

  it("refuses a layer kind it does not recognise rather than assuming it", () => {
    const result = estimateKvCache({
      info: { ...qwen2, layer_types: ["mamba", "attention"] },
      tokensPerSequence: 4096,
      sequences: 1,
      bytesPerElement: 2,
    });

    expect(result).toMatchObject({ ok: false, layerTypes: ["mamba"] });
  });

  it("estimates a checkpoint that states uniformly full attention", () => {
    const estimate = ok(
      estimateKvCache({
        info: { ...qwen2, layer_types: Array(28).fill("full_attention") },
        tokensPerSequence: 4096,
        sequences: 1,
        bytesPerElement: 2,
      }),
    );

    expect(estimate.bytesPerToken).toBe(57344);
  });

  it("refuses when there is no model info at all", () => {
    expect(
      estimateKvCache({
        info: null,
        tokensPerSequence: 4096,
        sequences: 1,
        bytesPerElement: 2,
      }),
    ).toMatchObject({ ok: false, reason: "no-model-info" });
  });

  it.each([
    { name: "no tokens", tokensPerSequence: 0, sequences: 1, bytes: 2 },
    { name: "no sequences", tokensPerSequence: 4096, sequences: 0, bytes: 2 },
    {
      name: "fractional tokens",
      tokensPerSequence: 4096.5,
      sequences: 1,
      bytes: 2,
    },
    {
      name: "no precision picked",
      tokensPerSequence: 4096,
      sequences: 1,
      bytes: null,
    },
  ])(
    "refuses to compute with $name",
    ({ tokensPerSequence, sequences, bytes }) => {
      expect(
        estimateKvCache({
          info: qwen2,
          tokensPerSequence,
          sequences,
          bytesPerElement: bytes,
        }),
      ).toMatchObject({ ok: false, reason: "invalid-input" });
    },
  );

  it("reports what the model is missing even before the inputs are valid", () => {
    // Which of the two the user is told about matters: an input they can fix
    // themselves is not the same as a checkpoint that cannot be estimated.
    expect(
      estimateKvCache({
        info: { num_hidden_layers: 32 },
        tokensPerSequence: 0,
        sequences: 1,
        bytesPerElement: 2,
      }),
    ).toMatchObject({ ok: false, reason: "missing-fields" });
  });
});

describe("defaultPrecisionId", () => {
  it.each([
    { dtype: "bfloat16", expected: "bf16" },
    { dtype: "float16", expected: "bf16" },
    { dtype: "float32", expected: "fp32" },
    { dtype: "float8_e4m3fn", expected: "fp8" },
    { dtype: "int8", expected: "fp8" },
    { dtype: "int4", expected: "fp4" },
  ])("maps $dtype onto $expected", ({ dtype, expected }) => {
    expect(defaultPrecisionId({ parameter_dtype: dtype })).toBe(expected);
  });

  it("picks nothing for a dtype it does not recognise or does not have", () => {
    expect(defaultPrecisionId({ parameter_dtype: "mxfp6" })).toBeNull();
    expect(defaultPrecisionId({})).toBeNull();
    expect(defaultPrecisionId(null)).toBeNull();
  });
});
