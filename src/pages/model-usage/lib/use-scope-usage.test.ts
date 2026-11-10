// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupUsageKind, GroupUsageRecord } from "@/domains/api-key/types";
import { buildOrgTree, indexNodes } from "@/domains/organization/lib/org-tree";
import type { OrgUnit } from "@/domains/organization/types";
import type { UsageScope } from "./usage-scope";

// Each call site of useGroupUsage answers the filters that are ready; for
// any other filters it keeps the rows of its previous answer, as the query
// cache does while new params load.
const ready = new Map<string, GroupUsageRecord[]>();
const lastByCall = new Map<number, GroupUsageRecord[]>();
let callIndex = 0;

vi.mock("@/domains/api-key/hooks/use-group-usage", () => ({
  useGroupUsage: (
    _workspace: string,
    _start: string,
    _end: string,
    kind: GroupUsageKind,
    filters: object[],
    enabled = true,
  ) => {
    const call = callIndex++;
    const base = { error: null, refetch: vi.fn() };
    if (!enabled || filters.length === 0) {
      return { ...base, usageData: [], isLoading: false, isPlaceholder: false };
    }
    const keys = filters.map((f) => `${kind}:${JSON.stringify(f)}`);
    if (keys.every((key) => ready.has(key))) {
      const rows = keys.flatMap((key) => ready.get(key) ?? []);
      lastByCall.set(call, rows);
      return {
        ...base,
        usageData: rows,
        isLoading: false,
        isPlaceholder: false,
      };
    }
    return {
      ...base,
      usageData: lastByCall.get(call) ?? [],
      isLoading: true,
      isPlaceholder: true,
    };
  },
}));
vi.mock("@/domains/api-key/hooks/use-workspace-usage", () => ({
  useWorkspaceUsage: () => ({
    usageData: [],
    isLoading: false,
    isPlaceholder: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/domains/organization/hooks/use-organization", () => ({
  useOrgUnitMembers: () => ({ members: [] }),
  useTeamMembers: () => ({ members: [] }),
}));

import { useScopeUsage } from "./use-scope-usage";

const unit = (id: number, path: string, name: string): OrgUnit =>
  ({
    id,
    path,
    metadata: { name, display_name: name.toUpperCase() },
    spec: { identity_source: "ldap" },
  }) as unknown as OrgUnit;

// rnd ── ml ── infer
const roots = buildOrgTree([
  unit(1, "/1/", "rnd"),
  unit(2, "/1/2/", "ml"),
  unit(3, "/1/2/3/", "infer"),
]);
const nodesByName = new Map(
  [...indexNodes(roots).values()].map((n) => [n.unit.metadata.name, n]),
);

const row = (
  kind: GroupUsageKind,
  name: string,
  usage: number,
): GroupUsageRecord => ({
  date: "2026-10-20",
  kind,
  name,
  display_name: name,
  workspace: "default",
  endpoint_type: "endpoint",
  endpoint_name: "chat",
  model_name: "qwen",
  requests: usage / 10,
  usage,
  prompt_tokens: usage * 0.8,
  completion_tokens: usage * 0.2,
});

const render = (scope: UsageScope) =>
  renderHook(
    ({ scope }) => {
      callIndex = 0;
      return useScopeUsage({
        workspace: "default",
        range: { start: "2026-10-01", end: "2026-10-30" },
        model: "",
        scope,
        teamsOpen: false,
        keysOpen: false,
        roots,
        nodesByName,
        teamsByName: new Map(),
        unassignedLabel: "No department",
      });
    },
    { initialProps: { scope } },
  );

const entries = (result: { current: ReturnType<typeof useScopeUsage> }) =>
  result.current.breakdownSeries.map((s) => [s.key, s.total]);

beforeEach(() => {
  ready.clear();
  lastByCall.clear();
});

describe("useScopeUsage", () => {
  it("never subtracts one department's child rows from another's", () => {
    // rnd: u1 used 300 in ml, u2 100 in rnd itself.
    ready.set('User:{"orgUnit":"rnd"}', [
      row("User", "u1", 300),
      row("User", "u2", 100),
    ]);
    ready.set('OrgUnit:{"orgUnit":"rnd"}', [
      row("OrgUnit", "rnd", 400),
      row("OrgUnit", "ml", 300),
    ]);
    ready.set('User:{"orgUnit":"ml"}', [row("User", "u1", 300)]);
    const { result, rerender } = render({ type: "orgUnit", name: "rnd" });
    const rnd = [
      ["ml", 300],
      ["user:u2", 100],
    ];
    expect(entries(result)).toEqual(rnd);

    // ml: u1's 300, of which 120 in infer. infer's rows are still loading,
    // and its call site still holds ml's child rows (u1 300).
    ready.set('OrgUnit:{"orgUnit":"ml"}', [
      row("OrgUnit", "ml", 300),
      row("OrgUnit", "infer", 120),
    ]);
    rerender({ scope: { type: "orgUnit", name: "ml" } });

    expect(result.current.loading).toBe(true);
    expect(entries(result)).toEqual(rnd);
    expect(result.current.totals.total).toBe(400);

    ready.set('User:{"orgUnit":"infer"}', [row("User", "u1", 120)]);
    rerender({ scope: { type: "orgUnit", name: "ml" } });

    expect(result.current.loading).toBe(false);
    expect(entries(result)).toEqual([
      ["user:u1", 180],
      ["infer", 120],
    ]);
    expect(result.current.breakdownSeries.every((s) => s.total >= 0)).toBe(
      true,
    );
  });

  it("shows nothing rather than a partial first answer", () => {
    ready.set('User:{"orgUnit":"rnd"}', [row("User", "u1", 300)]);
    const { result } = render({ type: "orgUnit", name: "rnd" });

    expect(result.current.loading).toBe(true);
    expect(result.current.breakdownSeries).toEqual([]);
    expect(result.current.totals).toEqual({
      prompt: 0,
      completion: 0,
      total: 0,
      requests: 0,
    });
  });
});
