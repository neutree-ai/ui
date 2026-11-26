import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SELF_HOSTED_MODEL_SOURCE } from "@/foundation/model-reference/model-source";
import {
  invokableModelOptions,
  useModelSourceByValue,
  useWorkspaceModelMap,
} from "./use-api-key-policy";

const { useListMock } = vi.hoisted(() => ({ useListMock: vi.fn() }));

vi.mock("@refinedev/core", () => ({
  useList: useListMock,
  useCustomMutation: vi.fn(),
}));

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

describe("useWorkspaceModelMap", () => {
  beforeEach(() => {
    useListMock.mockReset();
  });

  it("updates lookup maps when the first alias changes, retaining the external model", () => {
    mockWorkspaceModels(["a", "b"]);
    const { result, rerender } = renderHook(() => ({
      models: useWorkspaceModelMap("workspace-a"),
      sources: useModelSourceByValue("workspace-a"),
    }));
    expect(
      result.current.models
        .get("a")
        ?.endpoints.map((e) => e.name)
        .sort(),
    ).toEqual(["external", "local"]);
    expect(result.current.models.has("b")).toBe(false);
    expect(result.current.sources.get("internal:local:a")).toBe(
      SELF_HOSTED_MODEL_SOURCE,
    );

    mockWorkspaceModels(["b", "a"]);
    rerender();
    expect(
      result.current.models.get("a")?.endpoints.map((e) => e.name),
    ).toEqual(["external"]);
    expect(
      result.current.models.get("b")?.endpoints.map((e) => e.name),
    ).toEqual(["local"]);
    expect(result.current.sources.has("internal:local:a")).toBe(false);
    expect(result.current.sources.get("internal:local:b")).toBe(
      SELF_HOSTED_MODEL_SOURCE,
    );
    expect(result.current.sources.get("external:external:a")).toBe(
      "third-party-public",
    );
  });
});

describe("invokableModelOptions", () => {
  it("leaves out rows whose endpoint is being deleted", () => {
    const row = {
      model: "qwen",
      type: "internal",
      endpoint_name: "ep-qwen",
      source_label: null,
      phase: "Deleting",
    };
    expect(invokableModelOptions([row], [], "default")).toEqual([]);
  });

  it("builds options from list_invokable_models with phases when known", () => {
    const options = invokableModelOptions(
      [
        {
          model: "gpt-4o",
          type: "external",
          endpoint_name: "ep-vendor",
          source_label: "third-party-public",
        },
        {
          model: "qwen",
          type: "internal",
          endpoint_name: "ep-qwen",
          source_label: null,
        },
      ],
      [
        {
          value: "internal:ep-qwen:qwen",
          label: "qwen",
          model: "qwen",
          endpointName: "ep-qwen",
          type: "internal",
          source: SELF_HOSTED_MODEL_SOURCE,
          phase: "Running",
        },
      ],
      "default",
    );
    expect(options.map((o) => [o.value, o.source, o.phase])).toEqual([
      ["internal:ep-qwen:qwen", SELF_HOSTED_MODEL_SOURCE, "Running"],
      ["external:ep-vendor:gpt-4o", "third-party-public", null],
    ]);
  });

  it("takes the phase from the row, so endpoint reads are not needed", () => {
    const options = invokableModelOptions(
      [
        {
          model: "deepseek",
          type: "external",
          endpoint_name: "ep-vendor",
          source_label: "third-party-public",
          phase: "Running",
        },
      ],
      [],
      "default",
    );
    expect(options.map((o) => [o.value, o.phase])).toEqual([
      ["external:ep-vendor:deepseek", "Running"],
    ]);
  });
});
