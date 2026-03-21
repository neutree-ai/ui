import { renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlaygroundModels } from "./use-playground-models";

vi.mock("@refinedev/core", () => ({
  useCustom: vi.fn(),
}));

import { useCustom } from "@refinedev/core";

// biome-ignore lint/suspicious/noExplicitAny: partial Endpoint mock for testing
const endpoint = {
  metadata: { name: "test-ep", workspace: "default" },
} as any;

function mockModelsResponse(models: { id: string }[], isFetching = false) {
  // biome-ignore lint/suspicious/noExplicitAny: mock return doesn't need full Refine types
  vi.mocked(useCustom).mockReturnValue({
    data: { data: { data: models } },
    isFetching,
  } as any);
}

function renderWithForm(ep = endpoint) {
  return renderHook(() => {
    const form = useForm({ defaultValues: { model: "" } });
    const result = usePlaygroundModels(ep, form);
    return { ...result, form };
  });
}

describe("usePlaygroundModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps API response to model options", () => {
    mockModelsResponse([{ id: "llama-3" }, { id: "gpt-4" }]);
    const { result } = renderWithForm();

    expect(result.current.models).toEqual([
      { label: "llama-3", value: "llama-3" },
      { label: "gpt-4", value: "gpt-4" },
    ]);
  });

  it("returns empty models when API returns no data", () => {
    // biome-ignore lint/suspicious/noExplicitAny: mock return doesn't need full Refine types
    vi.mocked(useCustom).mockReturnValue({
      data: null,
      isFetching: false,
    } as any);
    const { result } = renderWithForm();

    expect(result.current.models).toEqual([]);
  });

  it("auto-selects first model when none selected", () => {
    mockModelsResponse([{ id: "llama-3" }, { id: "gpt-4" }]);
    const { result } = renderWithForm();

    expect(result.current.form.getValues("model")).toBe("llama-3");
  });

  it("does not override an already selected model", () => {
    mockModelsResponse([{ id: "llama-3" }, { id: "gpt-4" }]);
    const { result } = renderHook(() => {
      const form = useForm({ defaultValues: { model: "gpt-4" } });
      const res = usePlaygroundModels(endpoint, form);
      return { ...res, form };
    });

    expect(result.current.form.getValues("model")).toBe("gpt-4");
  });

  it("reflects isLoading state", () => {
    mockModelsResponse([], true);
    const { result } = renderWithForm();

    expect(result.current.isLoading).toBe(true);
  });

  it("passes correct URL based on endpoint metadata", () => {
    mockModelsResponse([]);
    renderWithForm();

    expect(vi.mocked(useCustom)).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/serve-proxy/default/test-ep/v1/models",
        method: "get",
      }),
    );
  });
});
