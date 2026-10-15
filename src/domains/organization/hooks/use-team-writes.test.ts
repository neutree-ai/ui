import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn();
const invalidate = vi.fn();

vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutateAsync, isLoading: false }),
  useInvalidate: () => invalidate,
  useList: vi.fn(),
  useCustom: vi.fn(),
}));

import type { Team } from "@/domains/organization/types";
import {
  TeamWriteNoRowError,
  useTeamMemberWrites,
  useTeamWrites,
} from "./use-organization";

const team = {
  id: 7,
  metadata: { name: "guild", display_name: "Guild", labels: { a: "b" } },
  spec: { identity_source: null, external_id: null },
} as unknown as Team;

beforeEach(() => {
  mutateAsync.mockReset();
  invalidate.mockReset();
});

describe("useTeamWrites", () => {
  it("creates a manual team and returns the row", async () => {
    mutateAsync.mockResolvedValue({ data: [team] });
    const { result } = renderHook(() => useTeamWrites());
    await expect(result.current.create("guild", "Guild")).resolves.toBe(team);
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      url: "/teams",
      method: "post",
      values: {
        metadata: { name: "guild", display_name: "Guild" },
        spec: { identity_source: null, external_id: null },
      },
      meta: { headers: { Prefer: "return=representation" } },
    });
  });

  it("renames with the whole metadata", async () => {
    mutateAsync.mockResolvedValue({ data: [team] });
    const { result } = renderHook(() => useTeamWrites());
    await result.current.rename(team, "Guild 2");
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      url: "/teams?id=eq.7",
      method: "patch",
      values: {
        metadata: {
          name: "guild",
          display_name: "Guild 2",
          labels: { a: "b" },
        },
      },
      meta: { headers: { Prefer: "return=representation" } },
    });
    expect(invalidate).toHaveBeenCalled();
  });

  it("fails a delete that changed no row", async () => {
    mutateAsync.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useTeamWrites());
    await expect(result.current.remove(team)).rejects.toBeInstanceOf(
      TeamWriteNoRowError,
    );
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("useTeamMemberWrites", () => {
  it("adds several users in one request", async () => {
    mutateAsync.mockResolvedValue({ data: [{}, {}] });
    const { result } = renderHook(() => useTeamMemberWrites(7));
    await result.current.add(["u-1", "u-2"]);
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      url: "/team_members",
      method: "post",
      values: [
        { team_id: 7, user_id: "u-1" },
        { team_id: 7, user_id: "u-2" },
      ],
    });
  });

  it("removes one membership and fails when none changed", async () => {
    mutateAsync.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useTeamMemberWrites(7));
    await expect(result.current.remove("u-1")).rejects.toMatchObject({
      target: "member",
    });
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      url: "/team_members?team_id=eq.7&user_id=eq.u-1",
      method: "delete",
    });
  });
});
