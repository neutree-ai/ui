import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCacheCapacityConfirmation } from "./use-cache-capacity-confirmation";

const on = (l1_size_gib: number) => ({ enabled: true, l1_size_gib });
const off = (l1_size_gib: number) => ({ enabled: false, l1_size_gib });

describe("useCacheCapacityConfirmation", () => {
  it.each([
    ["initial", undefined, on(3)],
    ["enabling", off(2), on(3)],
    ["unchanged", on(2), on(2)],
  ])("saves %s capacity without asking", (_, before, after) => {
    const save = vi.fn();
    const { result } = renderHook(useCacheCapacityConfirmation);

    act(() => result.current.confirmCapacity(before, after, save));

    expect(save).toHaveBeenCalledOnce();
    expect(result.current.pending).toBeNull();
  });

  it.each([
    ["a capacity change", on(2), on(3), false],
    ["disabling", on(2), off(2), true],
  ])("asks before %s", (_, before, after, disable) => {
    const save = vi.fn();
    const { result } = renderHook(useCacheCapacityConfirmation);

    act(() => result.current.confirmCapacity(before, after, save));

    expect(save).not.toHaveBeenCalled();
    expect(result.current.pending).toMatchObject({ disable });
  });

  it("cancel does not submit; confirm submits exactly once", () => {
    const save = vi.fn();
    const { result } = renderHook(useCacheCapacityConfirmation);

    act(() => result.current.confirmCapacity(on(2), on(3), save));
    act(() => result.current.cancel());
    expect(save).not.toHaveBeenCalled();
    expect(result.current.pending).toBeNull();

    act(() => result.current.confirmCapacity(on(2), on(3), save));
    act(() => result.current.confirm());
    expect(save).toHaveBeenCalledOnce();
    expect(result.current.pending).toBeNull();
  });
});
