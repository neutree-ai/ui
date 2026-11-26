import { describe, expect, it } from "vitest";
import type { ModelSpec } from "../types";
import {
  endpointModelRef,
  engineRefLabel,
  hasOptionalModelFields,
} from "./endpoint-display-model";

const model = (spec: Partial<ModelSpec>) => spec as ModelSpec;

describe("endpointModelRef", () => {
  it.each([
    ["with a version", { name: "qwen", version: "v1" }, "qwen:v1"],
    ["without a version", { name: "qwen", version: "" }, "qwen"],
  ])("labels a model %s", (_case, spec, label) => {
    expect(endpointModelRef(model(spec))?.label).toBe(label);
  });

  // A Flex endpoint omits spec.model, or keeps it with only the task.
  it.each([
    ["a missing model", null],
    ["a model without a name", model({ name: "", task: "text-generation" })],
  ])("names no model for %s", (_case, spec) => {
    expect(endpointModelRef(spec)).toBeNull();
  });
});

describe("engineRefLabel", () => {
  it.each([
    [{ engine: "vllm", version: "v0.24.0" }, "vllm:v0.24.0"],
    [{ engine: "vllm", version: "" }, "vllm"],
    [{ version: "v1" }, ""],
    [null, ""],
  ])("labels %j as %j", (engine, label) => {
    expect(engineRefLabel(engine)).toBe(label);
  });
});

describe("hasOptionalModelFields", () => {
  it.each([
    [{ version: "", file: "" }, false],
    [{ version: "1.5", file: "" }, true],
    [{ version: "", file: "model.gguf" }, true],
  ])("%j sets an optional field: %s", (values, expected) => {
    expect(hasOptionalModelFields(values)).toBe(expected);
  });
});
