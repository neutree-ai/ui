import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockMutateAsync = vi.fn();
vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutateAsync: mockMutateAsync }),
}));

import { useTestConnectivity } from "./use-test-connectivity";

type Params = Parameters<ReturnType<typeof useTestConnectivity>["test"]>[1];

const external = (overrides: Partial<Params> = {}) =>
  ({
    type: "external",
    url: "https://api.example.com/v1",
    credential: "sk-test",
    ...overrides,
  }) as Params;

async function runTest(key: number, params: Params) {
  const hook = renderHook(() => useTestConnectivity());
  let data!: Awaited<ReturnType<typeof hook.result.current.test>>;
  await act(async () => {
    data = await hook.result.current.test(key, params);
  });
  return { ...hook, data };
}

describe("useTestConnectivity", () => {
  it.each([
    {
      name: "external upstream",
      params: external(),
      values: {
        upstream: { url: "https://api.example.com/v1" },
        auth: { type: "bearer", credential: "sk-test" },
      },
    },
    {
      name: "external upstream of a saved endpoint",
      params: external({
        credential: "",
        name: "my-ee",
        workspace: "default",
        stored_upstream_url: "https://api.old.com/v1",
      }),
      values: {
        upstream: { url: "https://api.example.com/v1" },
        auth: { type: "bearer", credential: "" },
        name: "my-ee",
        workspace: "default",
        stored_upstream_url: "https://api.old.com/v1",
      },
    },
    {
      name: "endpoint reference",
      params: {
        type: "endpoint_ref",
        endpoint_ref: "internal",
        workspace: "default",
      } as Params,
      values: { endpoint_ref: "internal", workspace: "default" },
    },
  ])("posts the $name payload", async ({ params, values }) => {
    mockMutateAsync.mockResolvedValueOnce({ data: { success: true } });
    await runTest(0, params);
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/external_endpoints/test_connectivity",
        method: "post",
        values,
      }),
    );
  });

  it("returns and stores the API result, then clears the testing flag", async () => {
    const response = { success: true, latency_ms: 150, models: ["gpt-4o"] };
    mockMutateAsync.mockResolvedValueOnce({ data: response });
    const { result, data } = await runTest(0, external());
    expect(data).toEqual(response);
    expect(result.current.resultMap[0]).toEqual(response);
    expect(result.current.testingMap[0]).toBe(false);
  });

  it.each([
    { thrown: new Error("network error"), error: "network error" },
    { thrown: "string error", error: "string error" },
  ])(
    "turns a thrown $thrown into a failure result",
    async ({ thrown, error }) => {
      mockMutateAsync.mockRejectedValueOnce(thrown);
      const { result, data } = await runTest(1, external());
      expect(data).toEqual({ success: false, error });
      expect(result.current.resultMap[1]).toEqual(data);
      expect(result.current.testingMap[1]).toBe(false);
    },
  );

  it("keeps each upstream's result separate", async () => {
    mockMutateAsync
      .mockResolvedValueOnce({ data: { success: true } })
      .mockResolvedValueOnce({ data: { success: false, error: "refused" } });
    const { result } = renderHook(() => useTestConnectivity());
    await act(async () => {
      await result.current.test(0, external());
    });
    await act(async () => {
      await result.current.test(1, external());
    });
    expect(result.current.resultMap[0]?.success).toBe(true);
    expect(result.current.resultMap[1]?.error).toBe("refused");
  });
});
