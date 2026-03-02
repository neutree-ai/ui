import type { EndpointEngineRef } from "@/domains/endpoint/types";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEndpointEngineOptions } from "./use-endpoint-engine-options";

function makeEngine(
  name: string,
  versions: { version: string; values_schema?: Record<string, unknown> }[],
  tasks: string[],
): EndpointEngineRef {
  return {
    metadata: { name } as EndpointEngineRef["metadata"],
    spec: { versions, supported_tasks: tasks },
  };
}

const vllmEngine = makeEngine(
  "vllm",
  [
    {
      version: "0.6.0",
      values_schema: {
        properties: { tensor_parallel: { type: "integer" } },
      },
    },
    { version: "0.5.0" },
  ],
  ["text-generation", "embedding"],
);

const llamaCppEngine = makeEngine(
  "llama-cpp",
  [{ version: "1.0.0" }],
  ["text-generation"],
);

describe("useEndpointEngineOptions", () => {
  it("returns empty arrays when enginesData is undefined", () => {
    const { result } = renderHook(() =>
      useEndpointEngineOptions({
        enginesData: undefined,
        engineSpec: { engine: "", version: "" },
      }),
    );

    expect(result.current.engineNames).toEqual([]);
    expect(result.current.engineVersions).toEqual({});
    expect(result.current.engineTasks).toEqual({});
    expect(result.current.engineValueSchema).toBeUndefined();
  });

  it("derives engine names, versions, and tasks from enginesData", () => {
    const { result } = renderHook(() =>
      useEndpointEngineOptions({
        enginesData: [vllmEngine, llamaCppEngine],
        engineSpec: { engine: "", version: "" },
      }),
    );

    expect(result.current.engineNames).toEqual(["vllm", "llama-cpp"]);
    expect(result.current.engineVersions.vllm).toHaveLength(2);
    expect(result.current.engineVersions["llama-cpp"]).toHaveLength(1);
    expect(result.current.engineTasks.vllm).toEqual([
      "text-generation",
      "embedding",
    ]);
    expect(result.current.engineTasks["llama-cpp"]).toEqual([
      "text-generation",
    ]);
  });

  it("finds value schema for selected engine and version", () => {
    const { result } = renderHook(() =>
      useEndpointEngineOptions({
        enginesData: [vllmEngine, llamaCppEngine],
        engineSpec: { engine: "vllm", version: "0.6.0" },
      }),
    );

    expect(result.current.engineValueSchema).toEqual({
      properties: { tensor_parallel: { type: "integer" } },
    });
  });

  it("returns undefined schema when version has no values_schema", () => {
    const { result } = renderHook(() =>
      useEndpointEngineOptions({
        enginesData: [vllmEngine],
        engineSpec: { engine: "vllm", version: "0.5.0" },
      }),
    );

    expect(result.current.engineValueSchema).toBeUndefined();
  });

  it("returns undefined schema when no engine selected", () => {
    const { result } = renderHook(() =>
      useEndpointEngineOptions({
        enginesData: [vllmEngine],
        engineSpec: { engine: "", version: "" },
      }),
    );

    expect(result.current.engineValueSchema).toBeUndefined();
  });

  it("returns undefined schema when version not found", () => {
    const { result } = renderHook(() =>
      useEndpointEngineOptions({
        enginesData: [vllmEngine],
        engineSpec: { engine: "vllm", version: "9.9.9" },
      }),
    );

    expect(result.current.engineValueSchema).toBeUndefined();
  });
});
