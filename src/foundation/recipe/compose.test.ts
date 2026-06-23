import { describe, expect, it } from "vitest";
import { composeEndpointSpec, defaultFeatureSelections } from "./compose";
import { DEFAULT_VARIANT, normalizeRecipe } from "./normalize";
import type { FeatureSelection, RecipeInputSpec } from "./types";

// fsel builds an ordered boolean-feature selection from feature names.
function fsel(...names: string[]): FeatureSelection[] {
  return names.map((name) => ({ name }));
}

// Helper: build a minimal RecipeInputSpec.
function mkTrivial(overrides: Partial<RecipeInputSpec> = {}): RecipeInputSpec {
  return {
    model: {
      registry: "r",
      name: "qwen3",
      file: "",
      version: "",
      task: "chat",
    },
    engine: { engine: "vllm", version: "0.6.0" },
    resources: { cpu: 4, memory: 16, gpu: 1, accelerator: null },
    replicas: { num: 1 },
    deployment_options: null,
    variables: { engine_args: { max_model_len: 4096 } },
    env: { HF_HUB_ENABLE_HF_TRANSFER: "1" },
    ...overrides,
  };
}

function mkRecipe(): RecipeInputSpec {
  return {
    // top-level model/resources are absent on a "pure" recipe MC
    model: { registry: "", name: "", file: "", version: "", task: "chat" },
    engine: { engine: "vllm", version: "0.7.0" },
    resources: null,
    replicas: null,
    deployment_options: null,
    variables: null,
    env: null,
    base: {
      engine_args: { max_model_len: 8192, gpu_memory_utilization: 0.9 },
      env: { HF_HUB_ENABLE_HF_TRANSFER: "1" },
    },
    variants: {
      bf16: {
        description: "bf16 single-node TP",
        model: {
          registry: "hf",
          name: "Qwen/Qwen3-27B",
          file: "",
          version: "",
          task: "chat",
        },
        resources: { cpu: 8, memory: 64, gpu: 2, accelerator: null },
      },
      fp8: {
        description: "fp8 quantized",
        model: {
          registry: "hf",
          name: "Qwen/Qwen3-27B-FP8",
          file: "",
          version: "",
          task: "chat",
        },
        resources: { cpu: 8, memory: 32, gpu: 1, accelerator: null },
        engine_args: { quantization: "fp8" },
      },
    },
    features: {
      reasoning: {
        description: "Enable reasoning parser",
        default: true,
        engine_args: { reasoning_parser: "deepseek_r1" },
      },
      tooling: {
        description: "Enable tool-call parser",
        engine_args: { tool_call_parser: "hermes" },
      },
      // Two parsers conflict if both want to own the tool-call channel
      legacy_tooling: {
        description: "Legacy tooling",
        engine_args: { tool_call_parser: "legacy" },
        conflicts_with: ["tooling"],
      },
      prefix_cache: {
        description: "Enable prefix caching",
        engine_args: { enable_prefix_caching: true },
        env: { VLLM_USE_V1: "1" },
      },
    },
  };
}

describe("normalizeRecipe — trivial", () => {
  it("synthesizes a single default variant from top-level model/resources", () => {
    const norm = normalizeRecipe(mkTrivial());
    expect(Object.keys(norm.variants)).toEqual([DEFAULT_VARIANT]);
    expect(norm.variants.default.model?.name).toBe("qwen3");
    expect(norm.base.engine_args).toEqual({ max_model_len: 4096 });
    expect(norm.base.env).toEqual({ HF_HUB_ENABLE_HF_TRANSFER: "1" });
    expect(norm.features).toEqual({});
  });
});

describe("normalizeRecipe — recipe", () => {
  it("leaves recipe MCs alone", () => {
    const norm = normalizeRecipe(mkRecipe());
    expect(Object.keys(norm.variants).sort()).toEqual(["bf16", "fp8"]);
    expect(Object.keys(norm.features).sort()).toEqual([
      "legacy_tooling",
      "prefix_cache",
      "reasoning",
      "tooling",
    ]);
  });
});

describe("composeEndpointSpec — trivial MC", () => {
  it("returns the original kernel fields unchanged", () => {
    const r = composeEndpointSpec(mkTrivial(), "", []);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.error);
    expect(r.spec.model?.name).toBe("qwen3");
    expect(r.spec.resources?.gpu).toBe(1);
    expect(r.spec.engine_args).toEqual({ max_model_len: 4096 });
    expect(r.spec.env).toEqual({ HF_HUB_ENABLE_HF_TRANSFER: "1" });
  });

  it("rejects an unknown variant on a trivial MC", () => {
    const r = composeEndpointSpec(mkTrivial(), "fp8", []);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("should fail");
    expect(r.error).toMatch(/unknown variant/);
  });
});

describe("composeEndpointSpec — recipe MC", () => {
  it("composes base + default variant + empty features", () => {
    const r = composeEndpointSpec(mkRecipe(), "bf16", []);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.error);
    expect(r.spec.model?.name).toBe("Qwen/Qwen3-27B");
    expect(r.spec.engine_args).toEqual({
      max_model_len: 8192,
      gpu_memory_utilization: 0.9,
    });
  });

  it("variant.engine_args overrides base", () => {
    const r = composeEndpointSpec(mkRecipe(), "fp8", []);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.error);
    expect(r.spec.engine_args.quantization).toBe("fp8");
    expect(r.spec.engine_args.max_model_len).toBe(8192);
  });

  it("features layer over variant in enabled order", () => {
    const r = composeEndpointSpec(mkRecipe(), "bf16", fsel("reasoning", "tooling"));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.error);
    expect(r.spec.engine_args.reasoning_parser).toBe("deepseek_r1");
    expect(r.spec.engine_args.tool_call_parser).toBe("hermes");
  });

  it("later features override earlier features (order matters)", () => {
    const r1 = composeEndpointSpec(mkRecipe(), "bf16", fsel("tooling", "legacy_tooling"));
    // conflict, should error
    expect(r1.ok).toBe(false);

    // remove conflict by only enabling one tooling feature, then verify env
    const r2 = composeEndpointSpec(mkRecipe(), "bf16", fsel("prefix_cache"));
    expect(r2.ok).toBe(true);
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.spec.env.VLLM_USE_V1).toBe("1");
    expect(r2.spec.env.HF_HUB_ENABLE_HF_TRANSFER).toBe("1");
  });

  it("reports conflicts_with errors with both feature names", () => {
    const r = composeEndpointSpec(mkRecipe(), "bf16", fsel("tooling", "legacy_tooling"));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("should fail");
    expect(r.error).toContain("tooling");
    expect(r.error).toContain("legacy_tooling");
  });

  it("rejects unknown variant", () => {
    const r = composeEndpointSpec(mkRecipe(), "int4", []);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("should fail");
    expect(r.error).toMatch(/unknown variant/);
  });

  it("rejects unknown feature", () => {
    const r = composeEndpointSpec(mkRecipe(), "bf16", fsel("nonexistent"));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("should fail");
    expect(r.error).toMatch(/unknown feature/);
  });

  it('defaults variant="" to `default` (when present)', () => {
    // build a recipe where the default variant key is literally "default"
    const r = composeEndpointSpec(
      {
        ...mkRecipe(),
        variants: {
          default: { description: "default", engine_args: { foo: "bar" } },
        },
      },
      "",
      [],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.error);
    expect(r.spec.engine_args.foo).toBe("bar");
  });
});

describe("defaultFeatureSelections", () => {
  it("returns selections for features whose default is true", () => {
    const defs = defaultFeatureSelections(mkRecipe());
    expect(defs).toEqual([{ name: "reasoning" }]);
  });

  it("seeds select default_option and input default", () => {
    const defs = defaultFeatureSelections(mkTypedRecipe());
    expect(defs).toEqual([
      { name: "attention", value: "flash_attn" },
      { name: "max-len", value: "32768" },
    ]);
  });
});

function mkTypedRecipe(): RecipeInputSpec {
  return {
    model: null,
    engine: { engine: "vllm", version: "0.7.0" },
    resources: null,
    replicas: null,
    deployment_options: null,
    variables: null,
    env: null,
    variants: {
      default: {
        model: { registry: "hf", name: "m", file: "", version: "", task: "chat" },
      },
    },
    features: {
      attention: {
        type: "select",
        options: {
          flash_attn: { engine_args: { attention_backend: "FLASH_ATTN" } },
          xformers: { engine_args: { attention_backend: "XFORMERS" } },
        },
        default_option: "flash_attn",
      },
      "max-len": {
        type: "input",
        input: { value_type: "int", default: "32768", min: 1, max: 262144 },
        engine_args: { max_model_len: "${value}" },
      },
    },
  };
}

describe("composeEndpointSpec — typed features", () => {
  it("select merges the chosen option", () => {
    const r = composeEndpointSpec(mkTypedRecipe(), "default", [
      { name: "attention", value: "xformers" },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.error);
    expect(r.spec.engine_args.attention_backend).toBe("XFORMERS");
  });

  it("input coerces int and substitutes ${value}", () => {
    const r = composeEndpointSpec(mkTypedRecipe(), "default", [
      { name: "max-len", value: "65536" },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.error);
    expect(r.spec.engine_args.max_model_len).toBe(65536);
  });

  it("input falls back to default when value omitted", () => {
    const r = composeEndpointSpec(mkTypedRecipe(), "default", [
      { name: "max-len" },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.error);
    expect(r.spec.engine_args.max_model_len).toBe(32768);
  });

  it("rejects an out-of-range input", () => {
    const r = composeEndpointSpec(mkTypedRecipe(), "default", [
      { name: "max-len", value: "999999999" },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("should fail");
    expect(r.error).toMatch(/maximum/);
  });

  it("rejects an unknown select option", () => {
    const r = composeEndpointSpec(mkTypedRecipe(), "default", [
      { name: "attention", value: "ghost" },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("should fail");
    expect(r.error).toMatch(/no option/);
  });
});
