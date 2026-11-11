import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockMutateAsync = vi.fn();

vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutateAsync: mockMutateAsync }),
}));

import { ALL_WORKSPACES } from "@/foundation/hooks/use-workspace";
import { useWorkspaceUsage } from "./use-workspace-usage";

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: queryClient }, children);

describe("useWorkspaceUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    queryClient = new QueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    vi.useRealTimers();
  });

  it("does not fetch when no workspace is selected", () => {
    const { result } = renderHook(
      () => useWorkspaceUsage(undefined, "2025-01-01", "2025-02-01"),
      { wrapper },
    );

    expect(result.current.usageData).toEqual([]);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("forwards a concrete workspace as the p_workspace filter", async () => {
    mockMutateAsync.mockResolvedValueOnce({ data: [] });

    renderHook(() => useWorkspaceUsage("default", "2025-01-01", "2025-02-01"), {
      wrapper,
    });

    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/rpc/get_usage_by_dimension",
        method: "post",
        values: {
          p_start_date: "2025-01-01",
          p_end_date: "2025-02-01",
          p_workspace: "default",
        },
      }),
    );
  });

  it("omits p_workspace for the 'All workspaces' sentinel", async () => {
    mockMutateAsync.mockResolvedValueOnce({ data: [] });

    renderHook(
      () => useWorkspaceUsage(ALL_WORKSPACES, "2025-01-01", "2025-02-01"),
      { wrapper },
    );

    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    const call = mockMutateAsync.mock.calls[0][0];
    expect(call.values).toEqual({
      p_start_date: "2025-01-01",
      p_end_date: "2025-02-01",
    });
    // The literal "_all_" must never reach the backend, or the RPC's
    // `workspace = p_workspace` filter would match nothing.
    expect(call.values).not.toHaveProperty("p_workspace");
  });

  it("yields no cached rows while disabled", async () => {
    mockMutateAsync.mockResolvedValueOnce({ data: [{ usage: 1 }] });
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useWorkspaceUsage("default", "2025-01-01", "2025-02-01", enabled),
      { wrapper, initialProps: { enabled: true } },
    );
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.usageData).toHaveLength(1);

    // The same params from a caller that has no use for them.
    rerender({ enabled: false });

    expect(result.current.usageData).toEqual([]);
    expect(result.current.isPlaceholder).toBe(false);
  });
});
