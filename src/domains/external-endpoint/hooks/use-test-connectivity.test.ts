import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockMutateAsync = vi.fn();
vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutateAsync: mockMutateAsync }),
}));

import { useTestConnectivity } from "./use-test-connectivity";

describe("useTestConnectivity", () => {
  it("returns idle state initially", () => {
    const { result } = renderHook(() => useTestConnectivity());
    expect(result.current.testing).toBe(false);
    expect(result.current.result).toBeNull();
  });

  it("sends correct payload for external upstream", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      data: {
        success: true,
        latency_ms: 150,
        models: ["gpt-4o", "gpt-4o-mini"],
      },
    });

    const { result } = renderHook(() => useTestConnectivity());

    let data: Awaited<ReturnType<typeof result.current.test>>;
    await act(async () => {
      data = await result.current.test({
        type: "external",
        url: "https://api.openai.com/v1",
        credential: "sk-test",
      });
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      url: "/external_endpoints/test_connectivity",
      method: "post",
      values: {
        upstream: { url: "https://api.openai.com/v1" },
        auth: { type: "bearer", credential: "sk-test" },
      },
      successNotification: false,
      errorNotification: false,
    });

    expect(data!.success).toBe(true);
    expect(data!.latency_ms).toBe(150);
    expect(data!.models).toEqual(["gpt-4o", "gpt-4o-mini"]);

    expect(result.current.testing).toBe(false);
    expect(result.current.result).toEqual({
      success: true,
      latency_ms: 150,
      models: ["gpt-4o", "gpt-4o-mini"],
    });
  });

  it("sends correct payload for endpoint_ref", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      data: { success: true, latency_ms: 80, models: ["llama-3"] },
    });

    const { result } = renderHook(() => useTestConnectivity());

    let data: Awaited<ReturnType<typeof result.current.test>>;
    await act(async () => {
      data = await result.current.test({
        type: "endpoint_ref",
        endpoint_ref: "my-internal-endpoint",
        workspace: "default",
      });
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      url: "/external_endpoints/test_connectivity",
      method: "post",
      values: {
        endpoint_ref: "my-internal-endpoint",
        workspace: "default",
      },
      successNotification: false,
      errorNotification: false,
    });

    expect(data!.success).toBe(true);
    expect(data!.latency_ms).toBe(80);
    expect(data!.models).toEqual(["llama-3"]);
  });

  it("returns failure result from API", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      data: { success: false, error: "connection refused" },
    });

    const { result } = renderHook(() => useTestConnectivity());

    let data: Awaited<ReturnType<typeof result.current.test>>;
    await act(async () => {
      data = await result.current.test({
        type: "external",
        url: "https://bad.com/v1",
        credential: "sk-test",
      });
    });

    expect(data!.success).toBe(false);
    expect(data!.error).toBe("connection refused");
    expect(result.current.result?.success).toBe(false);
  });

  it("catches thrown errors and returns failure result", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("network error"));

    const { result } = renderHook(() => useTestConnectivity());

    let data: Awaited<ReturnType<typeof result.current.test>>;
    await act(async () => {
      data = await result.current.test({
        type: "external",
        url: "https://api.openai.com/v1",
        credential: "sk-test",
      });
    });

    expect(data!.success).toBe(false);
    expect(data!.error).toBe("network error");
    expect(result.current.testing).toBe(false);
  });

  it("handles non-Error thrown values", async () => {
    mockMutateAsync.mockRejectedValueOnce("string error");

    const { result } = renderHook(() => useTestConnectivity());

    let data: Awaited<ReturnType<typeof result.current.test>>;
    await act(async () => {
      data = await result.current.test({
        type: "endpoint_ref",
        endpoint_ref: "bad-endpoint",
        workspace: "default",
      });
    });

    expect(data!.success).toBe(false);
    expect(data!.error).toBe("string error");
  });
});
