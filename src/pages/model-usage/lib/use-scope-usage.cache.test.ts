// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GroupUsageKind, GroupUsageRecord } from "@/domains/api-key/types";
import { buildOrgTree, indexNodes } from "@/domains/organization/lib/org-tree";
import type { OrgUnit } from "@/domains/organization/types";
import type { UsageScope } from "./usage-scope";

// The real usage hooks over one query cache: only the RPC is faked.
type Values = {
  p_kind?: GroupUsageKind;
  p_org_unit?: string;
  p_direct?: boolean;
};

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

// The platform: u1 used 300 in rnd, u2 100 in no department, and the
// application sa1 800. rnd has no applications of its own.
const answer = ({ p_kind, p_org_unit, p_direct }: Values) => {
  if (p_kind === "User" && p_org_unit === "rnd")
    return [row("User", "u1", 300)];
  if (p_kind === "User" && !p_org_unit && p_direct)
    return [row("User", "u2", 100)];
  if (p_kind === "User" && !p_org_unit)
    return [row("User", "u1", 300), row("User", "u2", 100)];
  if (p_kind === "ServiceAccount" && !p_org_unit)
    return [row("ServiceAccount", "sa1", 800)];
  if (p_kind === "OrgUnit") return [row("OrgUnit", "rnd", 300)];
  return [];
};

vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({
    mutateAsync: async ({ values }: { values: Values }) => ({
      data: answer(values),
    }),
  }),
}));
vi.mock("@/domains/organization/hooks/use-organization", () => ({
  useOrgUnitMembers: () => ({ members: [] }),
  useTeamMembers: () => ({ members: [] }),
}));

import { useScopeUsage } from "./use-scope-usage";

const roots = buildOrgTree([
  {
    id: 1,
    path: "/1/",
    metadata: { name: "rnd", display_name: "R&D" },
    spec: { identity_source: "ldap" },
  } as unknown as OrgUnit,
]);
const nodesByName = new Map(
  [...indexNodes(roots).values()].map((n) => [n.unit.metadata.name, n]),
);

let queryClient: QueryClient;
afterEach(() => queryClient.clear());

const render = (scope: UsageScope) => {
  queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return renderHook(
    ({ scope }) =>
      useScopeUsage({
        workspace: "default",
        range: { start: "2026-10-01", end: "2026-10-30" },
        model: "",
        scope,
        teamsOpen: false,
        keysOpen: false,
        roots,
        nodesByName,
        teamsByName: new Map(),
        breakdownLabels: {
          unassigned: "No department",
          applications: "Applications",
          application: "Application",
        },
        deletedKeyLabel: (id) => `Deleted ${id}`,
      }),
    { initialProps: { scope }, wrapper },
  );
};

describe("useScopeUsage over the query cache", () => {
  it("counts no platform application in a department opened from the platform", async () => {
    const { result, rerender } = render({ type: "platform" });
    await waitFor(() => expect(result.current.totals.total).toBe(1200));

    rerender({ scope: { type: "orgUnit", name: "rnd" } });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.totals.total).toBe(300);
    expect(result.current.activity).toEqual({ users: 1, applications: 0 });
  });

  it("counts no platform user among the platform's applications", async () => {
    const { result, rerender } = render({ type: "platform" });
    await waitFor(() => expect(result.current.totals.total).toBe(1200));

    rerender({ scope: { type: "applications" } });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.totals.total).toBe(800);
    expect(result.current.activity).toEqual({ users: 0, applications: 1 });
  });
});
