import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn();

vi.mock("@refinedev/core", () => ({
  useCustom: vi.fn(),
  useList: vi.fn(),
  useInvalidate: () => vi.fn(),
  useCustomMutation: () => ({ mutateAsync, isLoading: false }),
}));

import {
  MembershipOutOfScopeError,
  useAssignOrgUnit,
} from "./use-organization";

describe("useAssignOrgUnit", () => {
  beforeEach(() => mutateAsync.mockReset());

  const assign = () => renderHook(() => useAssignOrgUnit("u-1")).result.current;

  it("asks for the changed rows on PATCH and DELETE", async () => {
    mutateAsync.mockResolvedValue({ data: [{ user_id: "u-1" }] });
    await assign().update(2);
    await assign().remove();
    for (const [args] of mutateAsync.mock.calls) {
      expect(args.meta).toEqual({
        headers: { Prefer: "return=representation" },
      });
    }
  });

  it.each([
    ["update", (a: ReturnType<typeof assign>) => a.update(2)],
    ["remove", (a: ReturnType<typeof assign>) => a.remove()],
  ])("reports a %s that changed no row", async (_, call) => {
    mutateAsync.mockResolvedValue({ data: [] });
    await expect(call(assign())).rejects.toBeInstanceOf(
      MembershipOutOfScopeError,
    );
  });

  it("leaves POST as is", async () => {
    mutateAsync.mockResolvedValue({ data: null });
    await assign().create(2);
    expect(mutateAsync.mock.calls[0][0].meta).toBeUndefined();
  });
});
