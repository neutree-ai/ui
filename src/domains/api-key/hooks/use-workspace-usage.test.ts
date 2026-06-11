import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockMutateAsync = vi.fn();

vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutateAsync: mockMutateAsync }),
}));

import { ALL_WORKSPACES } from "@/foundation/hooks/use-workspace";
import { useWorkspaceUsage } from "./use-workspace-usage";

describe("useWorkspaceUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not fetch when no workspace is selected", () => {
    const { result } = renderHook(() =>
      useWorkspaceUsage(undefined, "2025-01-01", "2025-02-01"),
    );

    expect(result.current.usageData).toEqual([]);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("forwards a concrete workspace as the p_workspace filter", async () => {
    mockMutateAsync.mockResolvedValueOnce({ data: [] });

    renderHook(() => useWorkspaceUsage("default", "2025-01-01", "2025-02-01"));

    await act(async () => {});

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

    renderHook(() =>
      useWorkspaceUsage(ALL_WORKSPACES, "2025-01-01", "2025-02-01"),
    );

    await act(async () => {});

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
});
