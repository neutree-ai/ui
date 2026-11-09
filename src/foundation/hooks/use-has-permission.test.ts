import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const custom = vi.fn();

vi.mock("@refinedev/core", () => ({
  useGetIdentity: vi.fn(),
  useCustom: vi.fn(),
  useDataProvider: () => () => ({ custom }),
}));

vi.mock("@tanstack/react-query", () => ({ useQueries: vi.fn() }));

import { useCustom, useGetIdentity } from "@refinedev/core";
import { useQueries } from "@tanstack/react-query";
import {
  useHasAnyPermission,
  useHasGlobalPermission,
  useHasPermission,
} from "./use-has-permission";

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

  it("asks has_permission_in_any_scope for the signed-in user", () => {
    identity("u-1");
    rpc({ data: true });
    const { result } = renderHook(() =>
      useHasPermission("identity_source:read"),
    );
    expect(result.current).toEqual({ allowed: true, isLoading: false });
    expect(vi.mocked(useCustom).mock.calls[0][0]).toMatchObject({
      url: "/rpc/has_permission_in_any_scope",
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

describe("useHasGlobalPermission", () => {
  beforeEach(() => {
    vi.mocked(useCustom).mockReset();
    vi.mocked(useGetIdentity).mockReset();
  });

  it("asks has_permission with no workspace, so only a global grant counts", () => {
    identity("u-1");
    rpc({ data: false });
    const { result } = renderHook(() => useHasGlobalPermission("team:read"));
    expect(result.current).toEqual({ allowed: false, isLoading: false });
    expect(vi.mocked(useCustom).mock.calls[0][0]).toMatchObject({
      url: "/rpc/has_permission",
      config: {
        payload: {
          user_uuid: "u-1",
          required_permission: "team:read",
          workspace: null,
        },
      },
    });
  });
});

describe("useHasAnyPermission", () => {
  const answers = (
    ...results: Array<{ data?: boolean; isLoading?: boolean }>
  ) =>
    vi
      .mocked(useQueries)
      .mockReturnValue(
        results.map((r) => ({ isLoading: false, ...r })) as never,
      );

  beforeEach(() => {
    vi.mocked(useQueries).mockReset();
    vi.mocked(useGetIdentity).mockReset();
    custom.mockReset();
  });

  it("allows as soon as one listed permission is held", () => {
    identity("u-1");
    answers({ data: false }, { isLoading: true }, { data: true });
    const { result } = renderHook(() =>
      useHasAnyPermission(["a:read", "b:read", "c:read"]),
    );
    expect(result.current).toEqual({ allowed: true, isLoading: false });
  });

  it("waits while a check is pending and none is held yet", () => {
    identity("u-1");
    answers({ data: false }, { isLoading: true });
    const { result } = renderHook(() =>
      useHasAnyPermission(["a:read", "b:read"]),
    );
    expect(result.current).toEqual({ allowed: undefined, isLoading: true });
  });

  it("refuses when none is held, and allows when none is asked", () => {
    identity("u-1");
    answers({ data: false });
    expect(
      renderHook(() => useHasAnyPermission("a:read")).result.current,
    ).toEqual({ allowed: false, isLoading: false });
    answers();
    expect(renderHook(() => useHasAnyPermission()).result.current).toEqual({
      allowed: true,
      isLoading: false,
    });
  });

  it("asks has_permission_in_any_scope per permission", async () => {
    identity("u-1");
    answers({ data: false });
    renderHook(() => useHasAnyPermission("a:read"));
    const [query] = vi.mocked(useQueries).mock.calls[0][0].queries as Array<{
      queryFn: () => Promise<boolean>;
    }>;
    custom.mockResolvedValue({ data: true });
    await expect(query.queryFn()).resolves.toBe(true);
    expect(custom).toHaveBeenCalledWith({
      url: "/rpc/has_permission_in_any_scope",
      method: "post",
      payload: { user_uuid: "u-1", required_permission: "a:read" },
    });
  });
});
