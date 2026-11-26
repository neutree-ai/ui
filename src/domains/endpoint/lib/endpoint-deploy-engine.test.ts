import { describe, expect, it } from "vitest";
import type {
  EndpointEngineRef,
  EndpointEngineVersionRef,
} from "@/domains/endpoint/types";
import {
  indexEndpointEngines,
  selectedEngineTasks,
  selectedEngineVersion,
} from "./endpoint-deploy-engine";

const makeEngine = (
  name: string,
  versions: EndpointEngineVersionRef[],
  tasks: string[] | null,
): EndpointEngineRef => ({
  metadata: { name } as EndpointEngineRef["metadata"],
  spec: { versions, supported_tasks: tasks },
});

const { engineNames, engineVersions, engineTasks } = indexEndpointEngines([
  makeEngine(
    "vllm",
    [
      { version: "0.24.0", supported_tasks: ["text-generation"] },
      { version: "0.5.0" },
    ],
    ["text-generation", "embedding"],
  ),
  makeEngine("legacy", [{ version: "1.0.0" }], null),
]);

describe("indexEndpointEngines", () => {
  it("keeps list order and reads a null task list as empty", () => {
    expect(engineNames).toEqual(["vllm", "legacy"]);
    expect(engineVersions.vllm).toHaveLength(2);
    expect(engineTasks.legacy).toEqual([]);
  });

  it("indexes nothing without engines", () => {
    expect(indexEndpointEngines(undefined)).toEqual({
      engineNames: [],
      engineVersions: {},
      engineTasks: {},
    });
  });
});

describe("selectedEngineVersion / selectedEngineTasks", () => {
  it.each([
    ["vllm", "0.24.0", "0.24.0", ["text-generation"]],
    ["vllm", "0.5.0", "0.5.0", ["text-generation", "embedding"]],
    ["vllm", "9.9.9", undefined, ["text-generation", "embedding"]],
    ["", "", undefined, []],
  ])("%s@%s -> version %s, tasks %o", (engine, version, found, tasks) => {
    const entry = selectedEngineVersion(engineVersions, engine, version);
    expect(entry?.version).toBe(found);
    expect(selectedEngineTasks(engineTasks, engine, entry)).toEqual(tasks);
  });
});
