import { describe, expect, it } from "vitest";
import { estimateModelWeightsGb } from "./estimate-weights";

describe("estimateModelWeightsGb", () => {
  it("estimates dense weights from parameter count and dtype", () => {
    expect(
      estimateModelWeightsGb({
        parameter_count: "8B",
        parameter_dtype: "bfloat16",
      }),
    ).toBe(16);
  });

  it("reads checkpoint-derived plain decimal counts literally", () => {
    expect(
      estimateModelWeightsGb({
        parameter_count: "8030261248",
        parameter_dtype: "BF16",
      }),
    ).toBeCloseTo(16.060522496);
  });

  it("prefers explicit quantization bits over the checkpoint dtype", () => {
    expect(
      estimateModelWeightsGb({
        parameter_count: "27B",
        parameter_dtype: "bfloat16",
        quantization_bits: 8,
      }),
    ).toBe(27);
  });

  it("supports compact counts and quantization labels", () => {
    expect(
      estimateModelWeightsGb({
        parameter_count: "500M",
        quantization: "int4",
      }),
    ).toBe(0.25);
  });

  it("does not invent a weight when either fact is missing", () => {
    expect(estimateModelWeightsGb({ parameter_count: "8B" })).toBeNull();
    expect(estimateModelWeightsGb({ parameter_dtype: "bf16" })).toBeNull();
  });
});
