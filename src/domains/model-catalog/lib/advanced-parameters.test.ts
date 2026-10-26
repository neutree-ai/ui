import { describe, expect, it } from "vitest";
import type { ModelCatalogSpec } from "../types";
import { modelCatalogEngineParameters } from "./advanced-parameters";

const baseSpec: ModelCatalogSpec = {
  model: null,
  engine: null,
  resources: null,
  replicas: null,
  deployment_options: null,
  variables: null,
  env: null,
};

describe("modelCatalogEngineParameters", () => {
  it("flattens nested and direct engine flags for an ordinary catalog", () => {
    expect(
      modelCatalogEngineParameters({
        ...baseSpec,
        variables: {
          dtype: "bfloat16",
          engine_args: {
            max_model_len: 32768,
            speculative_config: { method: "mtp" },
          },
        },
      }),
    ).toEqual({
      dtype: "bfloat16",
      max_model_len: 32768,
      speculative_config: { method: "mtp" },
    });
  });

  it("uses the engine arguments from every recipe layer", () => {
    expect(
      modelCatalogEngineParameters({
        ...baseSpec,
        variables: {
          engine_args: {
            tensor_parallel_size: 1,
          },
        },
        base: {
          engine_args: {
            reasoning_parser: "qwen3",
            max_model_len: 32768,
          },
        },
        variants: {
          default: {
            engine_args: { kv_cache_dtype: "fp8" },
          },
          long: {
            engine_args: { max_model_len: 131072 },
          },
        },
        features: [
          {
            name: "tool-choice",
            engine_args: { enable_auto_tool_choice: true },
          },
        ],
      }),
    ).toEqual({
      reasoning_parser: "qwen3",
      tensor_parallel_size: 1,
      kv_cache_dtype: "fp8",
      max_model_len: 131072,
      enable_auto_tool_choice: true,
    });
  });

  it("returns no rows when the catalog has no engine arguments", () => {
    expect(modelCatalogEngineParameters(baseSpec)).toEqual({});
  });
});
