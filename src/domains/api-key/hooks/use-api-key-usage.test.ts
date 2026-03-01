import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockMutateAsync = vi.fn();

vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutateAsync: mockMutateAsync }),
}));

import { POLL_INTERVAL_MS, useApiKeyUsage } from "./use-api-key-usage";

describe("useApiKeyUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const usageRecords = [
    {
      date: "2025-06-01",
      api_key_id: "1",
      api_key_name: "test",
      endpoint_name: "ep1",
      usage: 100,
    },
  ];

  it("returns empty data initially when no apiKeyId", () => {
    const { result } = renderHook(() => useApiKeyUsage(undefined));

    expect(result.current.usageData).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("fetches usage data when apiKeyId is provided", async () => {
    mockMutateAsync.mockResolvedValueOnce({ data: usageRecords });

    const { result } = renderHook(() => useApiKeyUsage("abc"));

    expect(result.current.isLoading).toBe(true);

    await act(async () => {});

    expect(result.current.usageData).toEqual(usageRecords);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/rpc/get_usage_by_dimension",
        method: "post",
        values: expect.objectContaining({ p_api_key_id: "abc" }),
      }),
    );
  });

  it("sets error on fetch failure", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("network error"));

    const { result } = renderHook(() => useApiKeyUsage("abc"));

    await act(async () => {});

    expect(result.current.usageData).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toEqual(new Error("network error"));
  });

  it("wraps non-Error throws into Error", async () => {
    mockMutateAsync.mockRejectedValueOnce("string error");

    const { result } = renderHook(() => useApiKeyUsage("abc"));

    await act(async () => {});

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("string error");
  });

  it("clears error on successful retry", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("fail"));

    const { result } = renderHook(() => useApiKeyUsage("abc"));

    await act(async () => {});
    expect(result.current.error).not.toBeNull();

    mockMutateAsync.mockResolvedValueOnce({ data: usageRecords });

    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.usageData).toEqual(usageRecords);
  });

  it("polls every 60 seconds", async () => {
    mockMutateAsync.mockResolvedValue({ data: [] });

    renderHook(() => useApiKeyUsage("abc"));

    await act(async () => {});
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(3);
  });

  it("refetches when apiKeyId changes", async () => {
    mockMutateAsync.mockResolvedValue({ data: usageRecords });

    const { rerender } = renderHook(({ id }) => useApiKeyUsage(id), {
      initialProps: { id: "a" as string | undefined },
    });

    await act(async () => {});
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);

    rerender({ id: "b" });

    await act(async () => {});
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    expect(mockMutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({ p_api_key_id: "b" }),
      }),
    );
  });
});
