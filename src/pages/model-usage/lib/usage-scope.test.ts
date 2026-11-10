import { describe, expect, it } from "vitest";
import type { ApiUsageRecord, GroupUsageRecord } from "@/domains/api-key/types";
import { buildOrgTree, indexNodes } from "@/domains/organization/lib/org-tree";
import type { OrgUnit } from "@/domains/organization/types";
import {
  buildBreakdown,
  groupFact,
  keyFact,
  scopeQueries,
  scopeTrail,
  summarizeBreakdown,
  sumUsage,
  UNASSIGNED_KEY,
  type UsageFact,
  type UsageScope,
} from "./usage-scope";

const unit = (id: number, path: string, name: string): OrgUnit =>
  ({
    id,
    path,
    metadata: { name, display_name: name.toUpperCase() },
    spec: { identity_source: "ldap" },
  }) as unknown as OrgUnit;

// rnd ─┬─ ml ── infer
//      └─ (direct users)
// market
const roots = buildOrgTree([
  unit(1, "/1/", "rnd"),
  unit(2, "/1/2/", "ml"),
  unit(3, "/1/2/3/", "infer"),
  unit(4, "/4/", "market"),
]);
const nodes = new Map(
  [...indexNodes(roots).values()].map((n) => [n.unit.metadata.name, n]),
);

const row = (
  kind: GroupUsageRecord["kind"],
  name: string,
  usage: number,
  overrides: Partial<GroupUsageRecord> = {},
) => groupFact(record(kind, name, usage, overrides));

const record = (
  kind: GroupUsageRecord["kind"],
  name: string,
  usage: number,
  overrides: Partial<GroupUsageRecord> = {},
): GroupUsageRecord => ({
  date: "2026-10-20",
  kind,
  name,
  display_name: `${name} display`,
  workspace: "default",
  endpoint_type: "endpoint",
  endpoint_name: "chat",
  model_name: "qwen",
  requests: usage / 10,
  usage,
  prompt_tokens: usage * 0.8,
  completion_tokens: usage * 0.2,
  ...overrides,
});

const breakdown = (
  scope: UsageScope,
  rows: {
    userRows?: UsageFact[];
    unitRows?: UsageFact[];
    directRows?: UsageFact[];
  },
) =>
  buildBreakdown({
    scope,
    nodes,
    roots,
    userRows: rows.userRows ?? [],
    unitRows: rows.unitRows ?? [],
    directRows: rows.directRows ?? [],
    unassignedLabel: "No department",
  });

const totalsByEntry = (facts: ReturnType<typeof breakdown>) => {
  const totals: Record<string, number> = {};
  for (const f of facts) totals[f.entry] = (totals[f.entry] ?? 0) + f.usage;
  return totals;
};

describe("scopeQueries", () => {
  const rnd = { type: "orgUnit", name: "rnd" } as const;
  const team = { type: "team", name: "t1", label: "T1" } as const;
  const user = (from: UsageScope | null) =>
    ({ type: "user", id: "u1", label: "U1", from }) as UsageScope;

  it("narrows a scope's User rows to its group, and a user to that group", () => {
    expect(scopeQueries({ type: "platform" }).user).toEqual({});
    expect(scopeQueries(rnd).user).toEqual({ orgUnit: "rnd" });
    expect(scopeQueries(team).user).toEqual({ team: "t1" });
    // In a department, what was recorded under it directly.
    expect(scopeQueries(user(rnd)).user).toEqual({
      name: "u1",
      orgUnit: "rnd",
      direct: true,
    });
    expect(scopeQueries(user(team)).user).toEqual({ name: "u1", team: "t1" });
    expect(scopeQueries(user(null)).user).toEqual({ name: "u1" });
  });

  it("splits the platform and a department into departments only", () => {
    expect(scopeQueries(null).units).toBeNull();
    expect(scopeQueries({ type: "platform" }).units).toEqual({});
    expect(scopeQueries(rnd).units).toEqual({ orgUnit: "rnd" });
    expect(scopeQueries(team).units).toBeNull();
    expect(scopeQueries(user(rnd)).units).toBeNull();
  });

  it("reads the usage under no department, or under a department itself", () => {
    expect(scopeQueries({ type: "platform" }).direct).toEqual({ direct: true });
    expect(scopeQueries(rnd).direct).toEqual({ orgUnit: "rnd", direct: true });
    expect(scopeQueries(team).direct).toBeNull();
    expect(scopeQueries(user(rnd)).direct).toBeNull();
    expect(scopeQueries(null).direct).toBeNull();
  });

  it("narrows usage by API key to a Team scope only", () => {
    expect(scopeQueries(team).keyTeam).toBe("t1");
    expect(scopeQueries(null).keyTeam).toBeUndefined();
    expect(scopeQueries({ type: "platform" }).keyTeam).toBeUndefined();
    expect(scopeQueries(user(team)).keyTeam).toBeUndefined();
  });
});

describe("scopeTrail", () => {
  const nodesById = indexNodes(roots);
  const trail = (scope: UsageScope | null, canReadAllGroups = true) =>
    scopeTrail(scope, {
      canReadAllGroups,
      nodesByName: nodes,
      nodesById,
      platformLabel: "Platform",
    }).map((crumb) => crumb.label);

  it("leads up from a department through the departments above", () => {
    expect(trail({ type: "orgUnit", name: "infer" })).toEqual([
      "Platform",
      "RND",
      "ML",
      "INFER",
    ]);
    expect(trail({ type: "orgUnit", name: "infer" }, false)).toEqual([
      "RND",
      "ML",
      "INFER",
    ]);
  });

  it("ends with the user, after the group they were opened from", () => {
    const team = { type: "team", name: "t1", label: "T1" } as const;
    expect(trail({ type: "user", id: "u1", label: "U1", from: team })).toEqual([
      "Platform",
      "T1",
      "U1",
    ]);
    expect(
      trail({
        type: "user",
        id: "u1",
        label: "U1",
        from: { type: "orgUnit", name: "ml" },
      }),
    ).toEqual(["Platform", "RND", "ML", "U1"]);
    expect(trail({ type: "platform" })).toEqual(["Platform"]);
    expect(trail(null)).toEqual([]);
  });

  it("points each crumb at its scope", () => {
    const [platform, rnd] = scopeTrail(
      { type: "orgUnit", name: "ml" },
      {
        canReadAllGroups: true,
        nodesByName: nodes,
        nodesById,
        platformLabel: "Platform",
      },
    );
    expect(platform.scope).toEqual({ type: "platform" });
    expect(rnd.scope).toEqual({ type: "orgUnit", name: "rnd" });
  });
});

describe("facts", () => {
  const keyRecord = (
    overrides: Partial<ApiUsageRecord> = {},
  ): ApiUsageRecord => ({
    date: "2026-10-20",
    api_key_id: "0123456789abcdef",
    api_key_name: "key",
    api_key_display_name: null,
    api_key_description: "",
    endpoint_type: "endpoint",
    endpoint_name: "chat",
    model_name: "qwen",
    workspace: "default",
    usage: 10,
    prompt_tokens: 8,
    completion_tokens: 2,
    ...overrides,
  });
  const deleted = (id: string) => `Deleted ${id}`;

  it("name a group row by its display name, an API key by its label", () => {
    expect(groupFact(record("User", "u1", 10)).who).toEqual({
      key: "u1",
      name: "u1 display",
      description: null,
    });
    expect(keyFact(keyRecord(), deleted).who).toEqual({
      key: "0123456789abcdef",
      name: "key",
      description: null,
    });
  });

  it("name a deleted API key by the start of its id", () => {
    expect(
      keyFact(
        keyRecord({
          api_key_name: null,
          api_key_display_name: null,
          api_key_description: null,
        }),
        deleted,
      ).who,
    ).toEqual({
      key: "0123456789abcdef",
      name: "Deleted 01234567",
      description: null,
    });
  });
});

describe("sumUsage", () => {
  it("adds up tokens, and requests only when the rows carry them", () => {
    expect(
      sumUsage([row("User", "a", 100), row("User", "b", 50)], true),
    ).toEqual({
      prompt: 120,
      completion: 30,
      total: 150,
      requests: 15,
    });
    expect(sumUsage([], true).requests).toBe(0);
    expect(sumUsage([row("User", "a", 100)], false).requests).toBeUndefined();
  });
});

describe("buildBreakdown", () => {
  it("splits the platform into its top departments and the users in none", () => {
    const facts = breakdown(
      { type: "platform" },
      {
        // 500 by users: 300 recorded in rnd's subtree, 150 in market, 50 in no
        // department.
        userRows: [
          row("User", "u1", 300),
          row("User", "u2", 150),
          row("User", "u3", 50),
        ],
        directRows: [row("User", "u3", 50)],
        // Every department's subtree total; only the top ones are entries.
        unitRows: [
          row("OrgUnit", "rnd", 300),
          row("OrgUnit", "ml", 200),
          row("OrgUnit", "infer", 120),
          row("OrgUnit", "market", 150),
        ],
      },
    );

    expect(totalsByEntry(facts)).toEqual({
      rnd: 300,
      market: 150,
      [UNASSIGNED_KEY]: 50,
    });
    expect(facts.find((f) => f.entry === "rnd")).toMatchObject({
      label: "RND",
      target: { type: "orgUnit", name: "rnd" },
    });
    expect(facts.find((f) => f.entry === UNASSIGNED_KEY)).toMatchObject({
      label: "No department",
      target: null,
    });
  });

  it("splits a department into its child departments and direct users", () => {
    const facts = breakdown(
      { type: "orgUnit", name: "rnd" },
      {
        // rnd's subtree by user: u1 only in ml, u2 in rnd itself, u3 in both
        // (moved from ml to rnd within the window).
        userRows: [
          row("User", "u1", 200),
          row("User", "u2", 80),
          row("User", "u3", 70),
        ],
        unitRows: [
          row("OrgUnit", "rnd", 350),
          row("OrgUnit", "ml", 270),
          row("OrgUnit", "infer", 120),
        ],
        // Recorded under rnd itself.
        directRows: [row("User", "u2", 80), row("User", "u3", 30)],
      },
    );

    expect(totalsByEntry(facts)).toEqual({
      ml: 270,
      "user:u2": 80,
      "user:u3": 30,
    });
    expect(facts.find((f) => f.entry === "user:u2")).toMatchObject({
      label: "u2 display",
      target: {
        type: "user",
        id: "u2",
        label: "u2 display",
        from: { type: "orgUnit", name: "rnd" },
      },
    });
  });

  it("splits a user into the models they used", () => {
    const facts = breakdown(
      {
        type: "user",
        id: "u1",
        label: "U1",
        from: { type: "orgUnit", name: "ml" },
      },
      {
        userRows: [
          row("User", "u1", 100),
          row("User", "u1", 20, { model_name: "llama" }),
          row("User", "u1", 5, { model_name: null }),
        ],
      },
    );

    expect(totalsByEntry(facts)).toEqual({ qwen: 100, llama: 20, "-": 5 });
    expect(facts.every((f) => f.target === null)).toBe(true);
  });

  it("splits a Team into its users, who lead back to the Team", () => {
    const team = { type: "team" as const, name: "alpha", label: "Alpha" };
    const facts = breakdown(team, {
      userRows: [row("User", "u1", 100), row("User", "u2", 40)],
    });

    expect(totalsByEntry(facts)).toEqual({ "user:u1": 100, "user:u2": 40 });
    expect(facts[0].target).toMatchObject({ type: "user", from: team });
  });
});

describe("summarizeBreakdown", () => {
  const rnd = { type: "orgUnit" as const, name: "rnd" };
  const facts = breakdown(rnd, {
    userRows: [row("User", "u2", 80)],
    unitRows: [row("OrgUnit", "ml", 50)],
    directRows: [row("User", "u2", 80)],
  });

  it("lists the members who used nothing after those who did", () => {
    const series = summarizeBreakdown(
      facts,
      [
        { id: "u2", label: "U2" },
        { id: "u9", label: "Zed" },
        { id: "u8", label: "Amy" },
      ],
      rnd,
    );

    expect(series.map((s) => [s.name, s.total])).toEqual([
      ["u2 display", 80],
      ["ML", 50],
      ["Amy", 0],
      ["Zed", 0],
    ]);
    const targetOf = (key: string) => series.find((s) => s.key === key)?.target;
    expect(targetOf("user:u9")).toEqual({
      type: "user",
      id: "u9",
      label: "Zed",
      from: rnd,
    });
    expect(targetOf("ml")).toEqual({ type: "orgUnit", name: "ml" });
  });

  it("adds no members outside a group scope", () => {
    const series = summarizeBreakdown(
      facts,
      [{ id: "u9", label: "Zed" }],
      null,
    );

    expect(series).toHaveLength(2);
  });
});
