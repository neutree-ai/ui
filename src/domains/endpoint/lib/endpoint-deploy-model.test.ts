import { describe, expect, it } from "vitest";
import type { ModelInfo } from "@/foundation/types/serving-types";
import {
  defaultEstimateTokens,
  kvCacheEstimateInputs,
  resolvedModelSummary,
  variantRegistry,
} from "./endpoint-deploy-model";

const model = { registry: "hf", name: "qwen", version: "", file: "" };

describe("resolvedModelSummary", () => {
  it.each([
    [{}, "auto"],
    [{ version: "v1" }, "v1"],
    [{ file: "q4.gguf" }, "auto · q4.gguf"],
    [{ version: "v1", file: "q4.gguf" }, "v1 · q4.gguf"],
  ])("%o -> %s", (overrides, versionFile) => {
    expect(
      resolvedModelSummary({ ...model, ...overrides }, "auto").versionFile,
    ).toBe(versionFile);
  });
});

it.each([
  [{ model: { ...model, task: "" } }, "hf"],
  [{ model: { ...model, task: "", registry: "" } }, null],
  [{}, null],
])("variantRegistry(%o) -> %s", (variant, registry) => {
  expect(variantRegistry(variant)).toBe(registry);
});

describe("kvCacheEstimateInputs", () => {
  it.each([
    [{}, { linearAttention: false, indexer: false, draftModules: false }],
    [{ layer_types: ["linear_attention"] }, { linearAttention: true }],
    [{ compress_ratios: [1, 4] }, { indexer: true, draftModules: true }],
    [{ compress_ratios: [4], num_hidden_layers: 1 }, { draftModules: false }],
    [{ mtp_num_layers: 1 }, { draftModules: true }],
  ])("%o -> %o", (info, inputs) => {
    expect(kvCacheEstimateInputs(info as ModelInfo)).toMatchObject(inputs);
  });
});

it.each([
  [
    { maxModelLen: 4096, maxNumSeqs: null },
    { max_position_embeddings: 32768 },
    4096,
  ],
  [
    { maxModelLen: null, maxNumSeqs: null },
    { max_position_embeddings: 32768 },
    32768,
  ],
  [{ maxModelLen: null, maxNumSeqs: null }, {}, null],
])("defaultEstimateTokens(%o, %o) -> %s", (args, info, tokens) => {
  expect(defaultEstimateTokens(args, info as ModelInfo)).toBe(tokens);
});
