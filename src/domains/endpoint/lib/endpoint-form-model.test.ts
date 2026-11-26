// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { type FieldValues, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import {
  alignTaskWithEngine,
  applyDefaultEngine,
  countModelChanges,
  engineChoice,
  modelIdentity,
} from "./endpoint-form-model";

const versions = [{ version: "v0.8.0" }, { version: "v0.10.1" }];

const engineForm = (spec: Record<string, unknown>) =>
  renderHook(() => useForm<FieldValues>({ defaultValues: { spec } })).result
    .current;

describe("engineChoice", () => {
  it.each([
    [["embedding", "text-generation"], "text-generation"],
    [["embedding", "rerank"], "embedding"],
    [[], ""],
  ])("tasks %j -> %s", (tasks, task) => {
    expect(engineChoice("vllm", versions, tasks)).toEqual({
      engine: { engine: "vllm", version: "v0.10.1" },
      task,
    });
  });
});

describe("applyDefaultEngine", () => {
  const apply = (spec: Record<string, unknown>, names = ["vllm"]) => {
    const form = engineForm(spec);
    act(() =>
      applyDefaultEngine(
        form,
        names,
        { vllm: versions },
        { vllm: ["text-generation"] },
      ),
    );
    return form.getValues("spec");
  };

  it("starts on vLLM at its newest version with its default task", () => {
    expect(apply({ engine: {}, model: { task: "" } })).toMatchObject({
      engine: { engine: "vllm", version: "v0.10.1" },
      model: { task: "text-generation" },
    });
  });

  it("keeps a chosen engine and an existing task", () => {
    expect(
      apply({ engine: { engine: "llama-cpp" }, model: { task: "" } }).engine,
    ).toEqual({ engine: "llama-cpp" });
    expect(apply({ engine: {}, model: { task: "embedding" } }).model.task).toBe(
      "embedding",
    );
  });

  it("sets nothing without vLLM", () => {
    expect(apply({ engine: {} }, ["llama-cpp"]).engine).toEqual({});
  });
});

describe("alignTaskWithEngine", () => {
  it.each([
    ["embedding", ["embedding"], "embedding"],
    ["rerank", ["embedding", "text-generation"], "text-generation"],
    ["rerank", [], "rerank"],
  ])("task %s with %j -> %s", (task, tasks, expected) => {
    const form = engineForm({ model: { task } });
    act(() => alignTaskWithEngine(form, tasks));
    expect(form.getValues("spec.model.task")).toBe(expected);
  });
});

describe("countModelChanges", () => {
  it("counts registry, name, version and file but not task", () => {
    const base = modelIdentity({ registry: "hf", name: "qwen", task: "a" });
    expect(
      countModelChanges(
        modelIdentity({ ...base, version: "v2", file: "x", task: "b" }),
        base,
      ),
    ).toBe(2);
  });
});
