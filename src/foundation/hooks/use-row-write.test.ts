import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn();
const invalidate = vi.fn();

vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutateAsync, isLoading: false }),
  useInvalidate: () => invalidate,
}));

import { useRowWrite } from "./use-row-write";

class GoneError extends Error {}

beforeEach(() => {
  mutateAsync.mockReset();
  invalidate.mockReset();
});

describe("useRowWrite", () => {
  it("asks for the written rows, stays quiet and invalidates the lists", async () => {
    mutateAsync.mockResolvedValue({ data: [{ id: 1 }] });
    const { result } = renderHook(() =>
      useRowWrite({ invalidates: ["teams", "team_members"] }),
    );
    await expect(
      result.current.run("/teams", "post", { name: "a" }),
    ).resolves.toEqual([{ id: 1 }]);
    expect(mutateAsync).toHaveBeenCalledWith({
      url: "/teams",
      method: "post",
      values: { name: "a" },
      meta: { headers: { Prefer: "return=representation" } },
      successNotification: false,
      errorNotification: false,
    });
    expect(invalidate.mock.calls.map(([arg]) => arg)).toEqual([
      { resource: "teams", invalidates: ["list"] },
      { resource: "team_members", invalidates: ["list"] },
    ]);
  });

  it.each(["patch", "delete"] as const)(
    "throws onNoRow when a %s changed no row, and invalidates nothing",
    async (method) => {
      mutateAsync.mockResolvedValue({ data: [] });
      const { result } = renderHook(() =>
        useRowWrite({ invalidates: ["teams"], onNoRow: () => new GoneError() }),
      );
      await expect(result.current.run("/teams", method)).rejects.toBeInstanceOf(
        GoneError,
      );
      expect(invalidate).not.toHaveBeenCalled();
    },
  );

  it("lets an empty answer pass for a post or without onNoRow", async () => {
    mutateAsync.mockResolvedValue({ data: [] });
    const { result } = renderHook(() =>
      useRowWrite({ invalidates: [], onNoRow: () => new GoneError() }),
    );
    await expect(result.current.run("/teams", "post", {})).resolves.toEqual([]);
    const plain = renderHook(() => useRowWrite({ invalidates: [] }));
    await expect(plain.result.current.run("/teams", "delete")).resolves.toEqual(
      [],
    );
  });

  it("cancels reads in flight and runs the further invalidation", async () => {
    mutateAsync.mockResolvedValue({ data: [{}] });
    const invalidateMore = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useRowWrite({
        invalidates: ["group_policies"],
        cancelRefetch: true,
        invalidateMore,
      }),
    );
    await result.current.run("/group_policies", "patch", {});
    expect(invalidate).toHaveBeenCalledWith({
      resource: "group_policies",
      invalidates: ["list"],
      invalidationOptions: { cancelRefetch: true },
    });
    expect(invalidateMore).toHaveBeenCalledOnce();
  });
});
