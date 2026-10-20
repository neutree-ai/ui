import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn();
const invalidate = vi.fn();

vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutateAsync, isLoading: false }),
  useInvalidate: () => invalidate,
  useList: vi.fn(),
  useCustom: vi.fn(),
  useDataProvider: vi.fn(),
}));

import type { GroupPolicy } from "@/domains/group-policy/types";
import {
  GroupPolicyGoneError,
  useGroupPolicyWrites,
} from "./use-group-policies";

const spec = {
  subject_kind: "OrgUnit" as const,
  subject_name: "rd",
  allowed_models: [{ model: "m" }],
  denied_models: null,
};
const policy = { id: 3, spec } as unknown as GroupPolicy;

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: queryClient }, children);
const renderWrites = () =>
  renderHook(() => useGroupPolicyWrites(), { wrapper });

beforeEach(() => {
  mutateAsync.mockReset();
  invalidate.mockReset();
  queryClient = new QueryClient();
});

describe("useGroupPolicyWrites", () => {
  it("creates a policy with no metadata.workspace", async () => {
    mutateAsync.mockResolvedValue({ data: [policy] });
    const { result } = renderWrites();
    await result.current.save(undefined, spec);
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      url: "/group_policies",
      method: "post",
      values: { api_version: "v1", kind: "GroupPolicy", metadata: {}, spec },
    });
    expect(invalidate).toHaveBeenCalledWith({
      resource: "group_policies",
      invalidates: ["list"],
      invalidationOptions: { cancelRefetch: true },
    });
  });

  it("refreshes the pool and user policy reads after a save", async () => {
    // refine's legacy key shape (its default) and its new one.
    const legacy = (url: string) => ["default", "custom", "post", url, {}];
    const current = (url: string) => [
      "data",
      "default",
      "custom",
      { method: "post", url },
    ];
    const keys = [
      legacy("/rpc/get_group_token_pools"),
      current("/rpc/get_user_group_policy"),
      legacy("/rpc/get_workspace_models"),
    ];
    for (const key of keys) queryClient.setQueryData(key, { data: [] });
    mutateAsync.mockResolvedValue({ data: [policy] });
    const { result } = renderWrites();
    await result.current.save(policy, spec);
    expect(
      keys.map((key) => queryClient.getQueryState(key)?.isInvalidated),
    ).toEqual([true, true, false]);
  });

  it("patches the whole spec, both lists included", async () => {
    mutateAsync.mockResolvedValue({ data: [policy] });
    const { result } = renderWrites();
    await result.current.save(policy, spec);
    const call = mutateAsync.mock.calls[0][0];
    expect(call.url).toBe("/group_policies?id=eq.3");
    expect(call.method).toBe("patch");
    expect(call.values.spec).toHaveProperty("denied_models", null);
  });

  it("reports a policy someone else removed", async () => {
    mutateAsync.mockResolvedValue({ data: [] });
    const { result } = renderWrites();
    await expect(result.current.remove(policy)).rejects.toBeInstanceOf(
      GroupPolicyGoneError,
    );
    expect(invalidate).not.toHaveBeenCalled();
  });
});
