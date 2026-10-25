import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@refinedev/core", () => ({
  useGetIdentity: vi.fn(),
  useCustom: vi.fn(),
}));

import { useCustom, useGetIdentity } from "@refinedev/core";
import { useHasPermission } from "./use-has-permission";

const identity = (id?: string, isLoading = false) =>
  vi
    .mocked(useGetIdentity)
    .mockReturnValue({ data: id ? { id } : undefined, isLoading } as never);

const rpc = (
  result: Partial<{ data: unknown; isLoading: boolean; isError: boolean }>,
) =>
  vi.mocked(useCustom).mockReturnValue({
    data: result.data === undefined ? undefined : { data: result.data },
    isLoading: result.isLoading ?? false,
    isError: result.isError ?? false,
  } as never);

describe("useHasPermission", () => {
  beforeEach(() => {
    vi.mocked(useCustom).mockReset();
    vi.mocked(useGetIdentity).mockReset();
  });

  it("asks has_permission for the signed-in user", () => {
    identity("u-1");
    rpc({ data: true });
    const { result } = renderHook(() =>
      useHasPermission("identity_source:read"),
    );
    expect(result.current).toEqual({ allowed: true, isLoading: false });
    expect(vi.mocked(useCustom).mock.calls[0][0]).toMatchObject({
      url: "/rpc/has_permission",
      method: "post",
      config: {
        payload: {
          user_uuid: "u-1",
          required_permission: "identity_source:read",
        },
      },
    });
  });

  it("denies when the database says no or the check fails", () => {
    identity("u-1");
    rpc({ data: false });
    expect(
      renderHook(() => useHasPermission("identity_source:read")).result.current
        .allowed,
    ).toBe(false);
    rpc({ isError: true });
    expect(
      renderHook(() => useHasPermission("identity_source:read")).result.current
        .allowed,
    ).toBe(false);
  });

  it("is undecided while loading", () => {
    identity("u-1");
    rpc({ isLoading: true });
    expect(
      renderHook(() => useHasPermission("identity_source:read")).result.current,
    ).toEqual({ allowed: undefined, isLoading: true });
  });

  it("allows everything when no permission is required", () => {
    identity("u-1");
    rpc({ isLoading: true });
    expect(renderHook(() => useHasPermission()).result.current).toEqual({
      allowed: true,
      isLoading: false,
    });
    expect(vi.mocked(useCustom).mock.calls[0][0].queryOptions?.enabled).toBe(
      false,
    );
  });
});
