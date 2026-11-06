import { describe, expect, it } from "vitest";
import {
  estimateModelWeightsGb,
  perReplicaRequiredGb,
} from "./estimate-weights";

const GIB = 1024 ** 3;

describe("estimateModelWeightsGb", () => {
  it.each([
    {
      name: "dense weights from parameter count and dtype",
      info: { parameter_count: "8B", parameter_dtype: "bfloat16" },
      bytes: 16e9,
    },
    {
      name: "a plain decimal count read literally",
      info: { parameter_count: "8030261248", parameter_dtype: "BF16" },
      bytes: 8030261248 * 2,
    },
    {
      name: "explicit quantization bits over the checkpoint dtype",
      info: {
        parameter_count: "27B",
        parameter_dtype: "bfloat16",
        quantization_bits: 8,
      },
      bytes: 27e9,
    },
    {
      name: "a compact count with a quantization label",
      info: { parameter_count: "500M", quantization: "int4" },
      bytes: 0.25e9,
    },
    {
      name: "a trillion-parameter count",
      info: { parameter_count: "1.5T", parameter_dtype: "fp8" },
      bytes: 1.5e12,
    },
  ])("estimates $name in 1024³-byte GB", ({ info, bytes }) => {
    expect(estimateModelWeightsGb(info)).toBeCloseTo(bytes / GIB, 9);
  });

  it("does not invent a weight when either fact is missing", () => {
    expect(estimateModelWeightsGb({ parameter_count: "8B" })).toBeNull();
    expect(estimateModelWeightsGb({ parameter_dtype: "bf16" })).toBeNull();
    expect(
      estimateModelWeightsGb({ parameter_count: "8B", parameter_dtype: "q5" }),
    ).toBeNull();
  });
});

describe("perReplicaRequiredGb", () => {
  it.each([
    { weights: 16, kv: 4, required: 20 },
    { weights: 16, kv: null, required: 16 },
    { weights: null, kv: 4, required: 4 },
    { weights: null, kv: null, required: null },
  ])("weights $weights + kv $kv -> $required", ({ weights, kv, required }) => {
    expect(perReplicaRequiredGb(weights, kv)).toBe(required);
  });
});
