import { describe, expect, it } from "vitest";
import {
  estimateCheckpointWeightsGb,
  estimateModelWeightsGb,
  perReplicaRequiredGb,
} from "./estimate-weights";

const GIB = 1024 ** 3;

describe("estimateModelWeightsGb", () => {
  it.each([
    { name: "decimal KB", size: "1.5 kB", bytes: 1.5e3 },
    { name: "decimal GB", size: "54 GB", bytes: 54e9 },
    { name: "binary MiB", size: "512 MiB", bytes: 512 * 1024 ** 2 },
    { name: "binary GiB", size: "54 GiB", bytes: 54 * GIB },
    { name: "decimal TB", size: "1.25 TB", bytes: 1.25e12 },
    { name: "plain bytes", size: "64 B", bytes: 64 },
  ])("converts $name to 1024³-byte GB", ({ size, bytes }) => {
    expect(estimateModelWeightsGb(size)).toBeCloseTo(bytes / GIB, 9);
  });

  it.each([undefined, null, "", "unknown", "0 GB", "-1 GB", "54"])(
    "does not invent a weight from %s",
    (size) => {
      expect(estimateModelWeightsGb(size)).toBeNull();
    },
  );

  it("does not infer precision from a model name", () => {
    expect(estimateModelWeightsGb("27B")).toBeNull();
  });
});

describe("estimateCheckpointWeightsGb", () => {
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
  ])("estimates $name in 1024³-byte GB", ({ info, bytes }) => {
    expect(estimateCheckpointWeightsGb(info)).toBeCloseTo(bytes / GIB, 9);
  });

  it("does not invent a weight when either fact is missing", () => {
    expect(estimateCheckpointWeightsGb({ parameter_count: "8B" })).toBeNull();
    expect(estimateCheckpointWeightsGb({ parameter_dtype: "bf16" })).toBeNull();
    expect(
      estimateCheckpointWeightsGb({
        parameter_count: "8B",
        parameter_dtype: "q5",
      }),
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
