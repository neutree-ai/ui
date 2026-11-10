import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SELF_HOSTED_MODEL_SOURCE } from "@/foundation/lib/model-source";
import {
  compareWorkspaceModelOptions,
  useWorkspaceModels,
  type WorkspaceModelOption,
} from "./use-workspace-models";

const { useListMock } = vi.hoisted(() => ({ useListMock: vi.fn() }));

vi.mock("@refinedev/core", () => ({ useList: useListMock }));

const mockWorkspaceModels = (
  servedModels: string[] | null | undefined,
  externalModel = "a",
) => {
  const endpoints = [
    {
      metadata: { name: "local" },
      spec: { model: { name: "physical-model" } },
      status: { served_models: servedModels },
    },
  ];
  const externalEndpoints = [
    {
      metadata: { name: "external" },
      spec: {
        upstreams: [{ model_mapping: { [externalModel]: "provider-model" } }],
        model_sources: { [externalModel]: "third-party-public" },
      },
    },
  ];
  useListMock.mockImplementation(({ resource }) => ({
    data: { data: resource === "endpoints" ? endpoints : externalEndpoints },
  }));
};

describe("compareWorkspaceModelOptions", () => {
  const opt = (
    over: Partial<WorkspaceModelOption> &
      Pick<WorkspaceModelOption, "model" | "endpointName">,
  ): WorkspaceModelOption => ({
    value: `${over.model}:${over.endpointName}`,
    label: over.model,
    type: "internal",
    source: over.type === "external" ? undefined : SELF_HOSTED_MODEL_SOURCE,
    phase: null,
    ...over,
  });

  it("orders Running endpoints before non-running ones within a source", () => {
    const paused = opt({
      model: "a",
      endpointName: "e1",
      type: "external",
      source: "partner",
      phase: "Paused",
    });
    const running = opt({
      model: "z",
      endpointName: "e2",
      type: "external",
      source: "partner",
      phase: "Running",
    });
    expect([paused, running].sort(compareWorkspaceModelOptions)).toEqual([
      running,
      paused,
    ]);
  });

  it("ranks a Degraded external endpoint with the serving ones", () => {
    // Degraded means some upstream is unavailable but the endpoint still
    // serves, so its models stay near the top rather than sinking to Failed.
    const failed = opt({
      model: "a",
      endpointName: "e1",
      type: "external",
      phase: "Failed",
    });
    const degraded = opt({
      model: "z",
      endpointName: "e2",
      type: "external",
      phase: "Degraded",
    });
    expect([failed, degraded].sort(compareWorkspaceModelOptions)).toEqual([
      degraded,
      failed,
    ]);
  });

  it("groups by source before sorting by name", () => {
    // Self-hosted is the first preset source, so a Running model without a
    // source that sorts alphabetically before a self-hosted one must still land
    // after every Running self-hosted model.
    const extA = opt({
      model: "aaa",
      endpointName: "e1",
      type: "external",
      phase: "Running",
    });
    const intZ = opt({
      model: "zzz",
      endpointName: "e2",
      type: "internal",
      phase: "Running",
    });
    expect([extA, intZ].sort(compareWorkspaceModelOptions)).toEqual([
      intZ,
      extA,
    ]);
  });

  it("falls back to model then endpoint within the same status+type group", () => {
    const a = opt({
      model: "alpha",
      endpointName: "e2",
      type: "internal",
      phase: "Running",
    });
    const b = opt({
      model: "alpha",
      endpointName: "e1",
      type: "internal",
      phase: "Running",
    });
    const c = opt({
      model: "beta",
      endpointName: "e1",
      type: "internal",
      phase: "Running",
    });
    expect([c, a, b].sort(compareWorkspaceModelOptions)).toEqual([b, a, c]);
  });

  it("keeps each source contiguous, even across status", () => {
    // Source is the primary grouping so the picker can render one heading per
    // source: a stopped self-hosted model stays in the self-hosted section
    // rather than sinking below the running external ones. Status still
    // decides the order inside a section.
    const ie1 = opt({
      model: "ie-1",
      endpointName: "ie-1",
      type: "internal",
      phase: "Running",
    });
    const ie2 = opt({
      model: "ie-2",
      endpointName: "ie-2",
      type: "internal",
      phase: "Running",
    });
    const ee1 = opt({
      model: "ee-1",
      endpointName: "ee-1",
      type: "external",
      phase: "Running",
    });
    const ee2 = opt({
      model: "ee-2",
      endpointName: "ee-2",
      type: "external",
      phase: "Running",
    });
    const ie3 = opt({
      model: "ie-3",
      endpointName: "ie-3",
      type: "internal",
      phase: "Stopped",
    });
    expect(
      [ee2, ie3, ee1, ie2, ie1].sort(compareWorkspaceModelOptions),
    ).toEqual([ie1, ie2, ie3, ee1, ee2]);
  });

  it("orders sources by the preset list, unknown slugs then unlabelled last", () => {
    const selfDeployed = opt({
      model: "m",
      endpointName: "ie",
      type: "internal",
    });
    const publicCloud = opt({
      model: "m",
      endpointName: "ee-public",
      type: "external",
      source: "third-party-public",
    });
    const custom = opt({
      model: "m",
      endpointName: "ee-custom",
      type: "external",
      source: "government-cloud",
    });
    const unlabelled = opt({
      model: "m",
      endpointName: "ee-plain",
      type: "external",
    });
    expect(
      [unlabelled, custom, publicCloud, selfDeployed].sort(
        compareWorkspaceModelOptions,
      ),
    ).toEqual([selfDeployed, publicCloud, custom, unlabelled]);
  });
});

describe("useWorkspaceModels", () => {
  beforeEach(() => {
    useListMock.mockReset();
  });

  it("leaves withdrawn endpoints out of both lists", () => {
    const endpoints = [
      {
        metadata: { name: "deleting" },
        status: { phase: "Deleting", served_models: ["stale"] },
      },
    ];
    const externalEndpoints = [
      {
        metadata: { name: "deleted" },
        status: { phase: "Deleted" },
        spec: { upstreams: [{ model_mapping: { stale: "provider" } }] },
      },
    ];
    useListMock.mockImplementation(({ resource }) => ({
      data: { data: resource === "endpoints" ? endpoints : externalEndpoints },
    }));
    const { result } = renderHook(() => useWorkspaceModels("workspace-a"));
    expect(result.current).toEqual([]);
  });

  it.each([
    { names: ["z-first", "a-second"], models: ["z-first"] },
    { names: [" model "], models: [" model "] },
    { names: undefined, models: [] },
    { names: null, models: [] },
    { names: [], models: [] },
    { names: ["", "second"], models: [] },
    { names: ["   ", "second"], models: [] },
  ])(
    "uses only the first observed name: $names -> $models",
    ({ names, models }) => {
      mockWorkspaceModels(names);
      const { result } = renderHook(() => useWorkspaceModels("workspace-a"));
      expect(
        result.current.filter((option) => option.type === "internal"),
      ).toEqual(
        models.map((model) =>
          expect.objectContaining({ model, value: `internal:local:${model}` }),
        ),
      );
    },
  );

  it("offers an external model name verbatim and resolves its source by it", () => {
    mockWorkspaceModels([], " gpt-4 ");
    const { result } = renderHook(() => useWorkspaceModels("workspace-a"));
    expect(result.current).toEqual([
      expect.objectContaining({
        model: " gpt-4 ",
        value: "external:external: gpt-4 ",
        source: "third-party-public",
      }),
    ]);
  });
});
