import { renderHook } from "@testing-library/react";
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

beforeEach(() => {
  mutateAsync.mockReset();
  invalidate.mockReset();
});

describe("useGroupPolicyWrites", () => {
  it("creates a policy with no metadata.workspace", async () => {
    mutateAsync.mockResolvedValue({ data: [policy] });
    const { result } = renderHook(() => useGroupPolicyWrites());
    await result.current.save(undefined, spec);
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      url: "/group_policies",
      method: "post",
      values: { api_version: "v1", kind: "GroupPolicy", metadata: {}, spec },
    });
    expect(invalidate).toHaveBeenCalledWith({
      resource: "group_policies",
      invalidates: ["list"],
    });
  });

  it("patches the whole spec, both lists included", async () => {
    mutateAsync.mockResolvedValue({ data: [policy] });
    const { result } = renderHook(() => useGroupPolicyWrites());
    await result.current.save(policy, spec);
    const call = mutateAsync.mock.calls[0][0];
    expect(call.url).toBe("/group_policies?id=eq.3");
    expect(call.method).toBe("patch");
    expect(call.values.spec).toHaveProperty("denied_models", null);
  });

  it("reports a policy someone else removed", async () => {
    mutateAsync.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useGroupPolicyWrites());
    await expect(result.current.remove(policy)).rejects.toBeInstanceOf(
      GroupPolicyGoneError,
    );
    expect(invalidate).not.toHaveBeenCalled();
  });
});
