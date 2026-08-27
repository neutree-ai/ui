import { describe, expect, it } from "vitest";
import {
  type EngineCacheArgs,
  findEngineCacheArgControls,
  NO_ENGINE_CACHE_ARGS,
  readEngineCacheArgs,
} from "@/domains/endpoint/lib/engine-cache-args";

const none: EngineCacheArgs = NO_ENGINE_CACHE_ARGS;

describe("readEngineCacheArgs", () => {
  it("reads vLLM's spelling of the two flags", () => {
    expect(
      readEngineCacheArgs("vllm", {
        max_model_len: 32768,
        max_num_seqs: 16,
        gpu_memory_utilization: 0.9,
      }),
    ).toEqual({ maxModelLen: 32768, maxNumSeqs: 16 });
  });

  it("reads SGLang's spelling of the same two flags", () => {
    // The quantities are the same; the flags are not, which is why the mapping
    // is per engine. vLLM's names read as nothing here and vice versa.
    expect(
      readEngineCacheArgs("sglang", {
        context_length: 8192,
        max_running_requests: 4,
      }),
    ).toEqual({ maxModelLen: 8192, maxNumSeqs: 4 });

    expect(
      readEngineCacheArgs("sglang", { max_model_len: 32768, max_num_seqs: 16 }),
    ).toEqual(none);
  });

  it("accepts the dashed command-line spelling of a flag", () => {
    expect(
      readEngineCacheArgs("vllm", {
        "max-model-len": 4096,
        "max-num-seqs": 8,
      }),
    ).toEqual({ maxModelLen: 4096, maxNumSeqs: 8 });
  });

  it("reads a numeric string, which is what a hand-written arg can be", () => {
    // A recipe input feature coerces ${value} to a number, but engine_args is a
    // free-form map and nothing stops a hand-edited one carrying a string.
    expect(readEngineCacheArgs("vllm", { max_model_len: "65536" })).toEqual({
      maxModelLen: 65536,
      maxNumSeqs: null,
    });
  });

  it("reads nothing from an engine it has no mapping for", () => {
    // Falling back to the checkpoint is visibly conservative. Matching some
    // other engine's flag name would produce a number off the wrong argument.
    expect(
      readEngineCacheArgs("some-new-engine", {
        max_model_len: 32768,
        max_num_seqs: 16,
      }),
    ).toEqual(none);
  });

  it.each([
    ["no engine", null, { max_model_len: 32768 }],
    ["no args", "vllm", null],
    ["empty args", "vllm", {}],
    ["a value of zero", "vllm", { max_model_len: 0 }],
    ["a negative value", "vllm", { max_model_len: -1 }],
    ["a non-numeric value", "vllm", { max_model_len: "auto" }],
    ["a fractional value", "vllm", { max_model_len: 1024.5 }],
  ])("reads nothing given %s", (_name, engine, args) => {
    expect(readEngineCacheArgs(engine, args)).toEqual(none);
  });

  it("reads one flag when only one is stated", () => {
    expect(readEngineCacheArgs("vllm", { max_num_seqs: 32 })).toEqual({
      maxModelLen: null,
      maxNumSeqs: 32,
    });
  });
});

describe("findEngineCacheArgControls", () => {
  const contextFeature = {
    name: "max-model-len",
    display_name: "Context window",
    engine_args: { max_model_len: "${value}" },
  };
  const concurrencyFeature = {
    name: "max-num-seqs",
    engine_args: { "max-num-seqs": "${value}" },
  };

  it("names the feature that writes each flag", () => {
    expect(
      findEngineCacheArgControls("vllm", [contextFeature, concurrencyFeature]),
    ).toEqual({
      // The label the control is shown under, so "change it there" points
      // somewhere the reader can see.
      context: "Context window",
      // No display name declared, so its identifier is the label.
      concurrency: "max-num-seqs",
    });
  });

  // A select feature sets the flag from whichever option is chosen; the control
  // on screen is still the feature.
  it("finds a flag written by one of a select feature's options", () => {
    const preset = {
      name: "context-preset",
      display_name: "Context preset",
      options: {
        long: { engine_args: { max_model_len: 131072 } },
        short: { engine_args: {} },
      },
    };

    expect(findEngineCacheArgControls("vllm", [preset]).context).toBe(
      "Context preset",
    );
  });

  it("reads each engine's own spelling", () => {
    const sglang = {
      name: "ctx",
      engine_args: { context_length: "${value}" },
    };

    expect(findEngineCacheArgControls("sglang", [sglang]).context).toBe("ctx");
    // vLLM spells it differently, so this feature controls nothing there.
    expect(findEngineCacheArgControls("vllm", [sglang]).context).toBeNull();
  });

  it("finds nothing without an engine, features, or a mapping", () => {
    expect(findEngineCacheArgControls("vllm", [])).toEqual({
      context: null,
      concurrency: null,
    });
    expect(findEngineCacheArgControls(null, [contextFeature])).toEqual({
      context: null,
      concurrency: null,
    });
    expect(findEngineCacheArgControls("unknown", [contextFeature])).toEqual({
      context: null,
      concurrency: null,
    });
  });

  it("ignores a feature that writes some other flag", () => {
    expect(
      findEngineCacheArgControls("vllm", [
        { name: "quant", engine_args: { quantization: "fp8" } },
      ]),
    ).toEqual({ context: null, concurrency: null });
  });
});
