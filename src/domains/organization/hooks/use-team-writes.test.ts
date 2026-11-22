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
    await expect(
      result.current.create({
        name: "guild",
        displayName: "Guild",
        project: true,
      }),
    ).resolves.toBe(team);
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      url: "/teams",
      method: "post",
      values: {
        metadata: {
          name: "guild",
          display_name: "Guild",
          labels: { "neutree.ai/team-kind": "project" },
        },
        spec: { identity_source: null, external_id: null },
      },
      meta: { headers: { Prefer: "return=representation" } },
    });
  });

  it("updates with the whole metadata", async () => {
    mutateAsync.mockResolvedValue({ data: [team] });
    const { result } = renderHook(() => useTeamWrites());
    await result.current.update(team, {
      displayName: "Guild 2",
      project: true,
    });
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      url: "/teams?id=eq.7",
      method: "patch",
      values: {
        metadata: {
          name: "guild",
          display_name: "Guild 2",
          labels: { a: "b", "neutree.ai/team-kind": "project" },
        },
      },
      meta: { headers: { Prefer: "return=representation" } },
    });
    expect(invalidate).toHaveBeenCalled();
  });

  it.each([
    { displayName: "Guild", project: false },
    { displayName: "", project: false },
    { displayName: "Renamed", project: true },
  ])("sends only metadata for edit $displayName / $project", async (values) => {
    const stored = {
      ...team,
      metadata: {
        ...team.metadata,
        annotations: { owner: "platform" },
        creation_timestamp: "2026-01-01T00:00:00Z",
      },
      status: { phase: "Active" as const },
    };
    mutateAsync.mockResolvedValue({ data: [stored] });
    const { result } = renderHook(() => useTeamWrites());
    await result.current.update(stored, values);
    expect(mutateAsync.mock.calls[0][0].values).toEqual({
      metadata: {
        ...stored.metadata,
        display_name: values.displayName,
        labels: values.project
          ? { a: "b", "neutree.ai/team-kind": "project" }
          : { a: "b" },
      },
    });
  });

  it("removes an unfamiliar team-kind value during a display-name edit", async () => {
    const stored = {
      ...team,
      metadata: {
        ...team.metadata,
        labels: { a: "b", "neutree.ai/team-kind": "custom" },
      },
    };
    mutateAsync.mockResolvedValue({ data: [stored] });
    const { result } = renderHook(() => useTeamWrites());
    await result.current.update(stored, {
      displayName: "Renamed",
      project: false,
    });
    expect(mutateAsync.mock.calls[0][0].values).toEqual({
      metadata: {
        ...stored.metadata,
        display_name: "Renamed",
        labels: { a: "b" },
      },
    });
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
