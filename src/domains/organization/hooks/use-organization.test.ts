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

  it("writes the membership row of the user", async () => {
    mutateAsync.mockResolvedValue({ data: [{ user_id: "u-1" }] });
    await assign().create(2);
    await assign().update(3);
    await assign().remove();
    expect(
      mutateAsync.mock.calls.map(([{ url, method, values }]) => ({
        url,
        method,
        values,
      })),
    ).toEqual([
      {
        url: "/org_unit_members",
        method: "post",
        values: { user_id: "u-1", org_unit_id: 2 },
      },
      {
        url: "/org_unit_members?user_id=eq.u-1",
        method: "patch",
        values: { org_unit_id: 3 },
      },
      { url: "/org_unit_members?user_id=eq.u-1", method: "delete", values: {} },
    ]);
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

  it("never reports a create as out of scope", async () => {
    mutateAsync.mockResolvedValue({ data: [] });
    await expect(assign().create(2)).resolves.toBeUndefined();
  });
});
