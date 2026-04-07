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
    expect(result.current.testingMap).toEqual({});
    expect(result.current.resultMap).toEqual({});
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
      data = await result.current.test(0, {
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

    expect(result.current.testingMap[0]).toBe(false);
    expect(result.current.resultMap[0]).toEqual({
      success: true,
      latency_ms: 150,
      models: ["gpt-4o", "gpt-4o-mini"],
    });
  });

  it("sends name, workspace and stored_upstream_url for external upstream when provided", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      data: { success: true, latency_ms: 200, models: ["gpt-4o"] },
    });

    const { result } = renderHook(() => useTestConnectivity());

    await act(async () => {
      await result.current.test(0, {
        type: "external",
        url: "https://api.new-provider.com/v1",
        credential: "",
        name: "my-ee",
        workspace: "default",
        stored_upstream_url: "https://api.openai.com/v1",
      });
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      url: "/external_endpoints/test_connectivity",
      method: "post",
      values: {
        upstream: { url: "https://api.new-provider.com/v1" },
        auth: { type: "bearer", credential: "" },
        name: "my-ee",
        workspace: "default",
        stored_upstream_url: "https://api.openai.com/v1",
      },
      successNotification: false,
      errorNotification: false,
    });
  });

  it("sends correct payload for endpoint_ref", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      data: { success: true, latency_ms: 80, models: ["llama-3"] },
    });

    const { result } = renderHook(() => useTestConnectivity());

    let data: Awaited<ReturnType<typeof result.current.test>>;
    await act(async () => {
      data = await result.current.test(1, {
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
      data = await result.current.test(0, {
        type: "external",
        url: "https://bad.com/v1",
        credential: "sk-test",
      });
    });

    expect(data!.success).toBe(false);
    expect(data!.error).toBe("connection refused");
    expect(result.current.resultMap[0]?.success).toBe(false);
  });

  it("catches thrown errors and returns failure result", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("network error"));

    const { result } = renderHook(() => useTestConnectivity());

    let data: Awaited<ReturnType<typeof result.current.test>>;
    await act(async () => {
      data = await result.current.test(0, {
        type: "external",
        url: "https://api.openai.com/v1",
        credential: "sk-test",
      });
    });

    expect(data!.success).toBe(false);
    expect(data!.error).toBe("network error");
    expect(result.current.testingMap[0]).toBe(false);
  });

  it("handles non-Error thrown values", async () => {
    mockMutateAsync.mockRejectedValueOnce("string error");

    const { result } = renderHook(() => useTestConnectivity());

    let data: Awaited<ReturnType<typeof result.current.test>>;
    await act(async () => {
      data = await result.current.test(1, {
        type: "endpoint_ref",
        endpoint_ref: "bad-endpoint",
        workspace: "default",
      });
    });

    expect(data!.success).toBe(false);
    expect(data!.error).toBe("string error");
  });

  it("isolates state between different upstream indices", async () => {
    mockMutateAsync
      .mockResolvedValueOnce({
        data: { success: true, latency_ms: 100, models: ["model-a"] },
      })
      .mockResolvedValueOnce({
        data: { success: false, error: "connection refused" },
      });

    const { result } = renderHook(() => useTestConnectivity());

    await act(async () => {
      await result.current.test(0, {
        type: "external",
        url: "https://good.com/v1",
        credential: "sk-good",
      });
    });

    await act(async () => {
      await result.current.test(1, {
        type: "external",
        url: "https://bad.com/v1",
        credential: "sk-bad",
      });
    });

    // upstream 0 should still show success
    expect(result.current.resultMap[0]?.success).toBe(true);
    expect(result.current.resultMap[0]?.models).toEqual(["model-a"]);

    // upstream 1 should show failure
    expect(result.current.resultMap[1]?.success).toBe(false);
    expect(result.current.resultMap[1]?.error).toBe("connection refused");
  });
});
