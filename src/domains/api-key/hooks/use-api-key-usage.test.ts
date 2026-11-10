import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockMutateAsync = vi.fn();

vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutateAsync: mockMutateAsync }),
}));

import { useApiKeyUsage } from "./use-api-key-usage";
import { POLL_INTERVAL_MS } from "./use-usage-rpc";

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: queryClient }, children);
const render = <P, R>(hook: (props: P) => R, initialProps?: P) =>
  renderHook(hook, { wrapper, initialProps });

// Moves the clock, then lets the query cache settle: it notifies through
// zero-delay timers, which a zero-length advance does not reach.
const flush = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    await vi.advanceTimersByTimeAsync(1);
  });

describe("useApiKeyUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    queryClient = new QueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.useRealTimers();
  });

  const usageRecords = [
    {
      date: "2025-06-01",
      api_key_id: "1",
      api_key_name: "test",
      endpoint_type: "endpoint",
      endpoint_name: "ep1",
      model_name: "llama-3",
      workspace: "default",
      usage: 100,
      prompt_tokens: 30,
      completion_tokens: 70,
    },
    {
      date: "2025-05-15",
      api_key_id: "1",
      api_key_name: "test",
      endpoint_type: null,
      endpoint_name: "legacy-ep",
      model_name: null,
      workspace: "default",
      usage: 500,
      prompt_tokens: null,
      completion_tokens: null,
    },
  ];

  it("returns empty data initially when no apiKeyId", () => {
    const { result } = render(() => useApiKeyUsage(undefined));

    expect(result.current.usageData).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("fetches usage data when apiKeyId is provided", async () => {
    mockMutateAsync.mockResolvedValueOnce({ data: usageRecords });

    const { result } = render(() => useApiKeyUsage("abc"));

    expect(result.current.isLoading).toBe(true);

    await flush();

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

    const { result } = render(() => useApiKeyUsage("abc"));

    await flush();

    expect(result.current.usageData).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toEqual(new Error("network error"));
  });

  it("wraps non-Error throws into Error", async () => {
    mockMutateAsync.mockRejectedValueOnce("string error");

    const { result } = render(() => useApiKeyUsage("abc"));

    await flush();

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("string error");
  });

  it("clears error on successful retry", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("fail"));

    const { result } = render(() => useApiKeyUsage("abc"));

    await flush();
    expect(result.current.error).not.toBeNull();

    mockMutateAsync.mockResolvedValueOnce({ data: usageRecords });

    await flush(POLL_INTERVAL_MS);

    expect(result.current.error).toBeNull();
    expect(result.current.usageData).toEqual(usageRecords);
  });

  it("drops previously loaded data when a later poll fails", async () => {
    mockMutateAsync.mockResolvedValueOnce({ data: usageRecords });

    const { result } = render(() => useApiKeyUsage("abc"));

    await flush();
    expect(result.current.usageData).toEqual(usageRecords);

    // A failed refresh/poll must not leave stale rows on screen.
    mockMutateAsync.mockRejectedValueOnce(new Error("boom"));

    await flush(POLL_INTERVAL_MS);

    expect(result.current.usageData).toEqual([]);
    expect(result.current.error).toEqual(new Error("boom"));
  });

  it("polls every 60 seconds", async () => {
    mockMutateAsync.mockResolvedValue({ data: [] });

    render(() => useApiKeyUsage("abc"));

    await flush();
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);

    await flush(POLL_INTERVAL_MS);
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);

    await flush(POLL_INTERVAL_MS);
    expect(mockMutateAsync).toHaveBeenCalledTimes(3);
  });

  it("refetches when apiKeyId changes", async () => {
    mockMutateAsync.mockResolvedValue({ data: usageRecords });

    const { rerender } = render(
      ({ id }: { id?: string }) => useApiKeyUsage(id),
      {
        id: "a",
      },
    );

    await flush();
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);

    rerender({ id: "b" });

    await flush();
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    expect(mockMutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({ p_api_key_id: "b" }),
      }),
    );
  });
});
