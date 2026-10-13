import { describe, expect, it } from "vitest";
import type { OrgUnit, Team } from "@/domains/organization/types";
import {
  buildOrgTree,
  expandableIds,
  filterOrgTree,
  filterTeams,
  groupByIdentitySource,
  indexNodes,
  type OrgTreeNode,
  orgUnitPathLabel,
} from "./org-tree";

const unit = (
  id: number,
  path: string,
  displayName: string,
  opts: { source?: string; inactive?: boolean } = {},
): OrgUnit =>
  ({
    id,
    kind: "OrgUnit",
    metadata: { name: `ou-${id}`, display_name: displayName },
    spec: { identity_source: opts.source ?? "corp", external_id: `x${id}` },
    status: { phase: opts.inactive ? "Inactive" : "Active" },
    path,
  }) as OrgUnit;

const team = (id: number, displayName: string, inactive = false): Team =>
  ({
    id,
    kind: "Team",
    metadata: { name: `team-${id}`, display_name: displayName },
    spec: { identity_source: "corp", external_id: `t${id}` },
    status: { phase: inactive ? "Inactive" : "Active" },
  }) as Team;

// Shape of a forest as nested labels, for readable assertions.
const shape = (nodes: OrgTreeNode[]): unknown[] =>
  nodes.map((n) =>
    n.children.length ? [n.label, shape(n.children)] : n.label,
  );

const corp = [
  unit(1, "/1/", "Corp"),
  unit(2, "/1/2/", "Engineering"),
  unit(3, "/1/2/3/", "Platform"),
  unit(4, "/1/2/4/", "Data"),
  unit(5, "/1/5/", "Finance", { inactive: true }),
  unit(6, "/1/5/6/", "Payroll"),
];

describe("buildOrgTree", () => {
  it("builds the forest from paths, sorted by display name", () => {
    expect(shape(buildOrgTree(corp))).toEqual([
      [
        "Corp",
        [
          ["Engineering", ["Data", "Platform"]],
          ["Finance", ["Payroll"]],
        ],
      ],
    ]);
  });

  it("labels each node with the display names along its path", () => {
    const node = indexNodes(buildOrgTree(corp)).get(3);
    expect(node?.pathLabel).toBe("Corp / Engineering / Platform");
  });

  it("falls back to metadata.name without a display name", () => {
    const [root] = buildOrgTree([
      { ...unit(1, "/1/", ""), metadata: { name: "ou-1", display_name: " " } },
    ] as OrgUnit[]);
    expect(root.label).toBe("ou-1");
  });

  it("makes a subtree a root when its ancestors are not readable", () => {
    // A department admin bound to Engineering reads only its subtree.
    const roots = buildOrgTree(corp.slice(1, 4));
    expect(shape(roots)).toEqual([["Engineering", ["Data", "Platform"]]]);
    expect(indexNodes(roots).get(3)?.pathLabel).toBe("Engineering / Platform");
  });

  it("hangs a node under its nearest readable ancestor", () => {
    const roots = buildOrgTree([corp[0], corp[2]]);
    expect(shape(roots)).toEqual([["Corp", ["Platform"]]]);
  });
});

describe("groupByIdentitySource", () => {
  it("groups roots by identity source, sorted by source name", () => {
    const roots = buildOrgTree([
      ...corp,
      unit(7, "/7/", "HQ", { source: "acme" }),
    ]);
    expect(
      groupByIdentitySource(roots).map((g) => [
        g.identitySource,
        shape(g.roots),
      ]),
    ).toEqual([
      ["acme", ["HQ"]],
      ["corp", [expect.any(Array)]],
    ]);
  });
});

describe("filterOrgTree", () => {
  const roots = buildOrgTree(corp);

  it("hides Inactive departments by default", () => {
    expect(shape(filterOrgTree(roots, {}))).toEqual([
      [
        "Corp",
        [
          ["Engineering", ["Data", "Platform"]],
          ["Finance", ["Payroll"]],
        ],
      ],
    ]);
    // Finance stays as context for its active child; alone it is hidden.
    const onlyFinance = buildOrgTree([corp[0], corp[4]]);
    expect(shape(filterOrgTree(onlyFinance, {}))).toEqual(["Corp"]);
    expect(shape(filterOrgTree(onlyFinance, { showInactive: true }))).toEqual([
      ["Corp", ["Finance"]],
    ]);
  });

  it("matches the query against the whole path, case-insensitively", () => {
    // "engineering" is in the paths of Engineering and of its sub-departments.
    expect(shape(filterOrgTree(roots, { query: "  engineering " }))).toEqual([
      ["Corp", [["Engineering", ["Data", "Platform"]]]],
    ]);
    expect(shape(filterOrgTree(roots, { query: "eering / plat" }))).toEqual([
      ["Corp", [["Engineering", ["Platform"]]]],
    ]);
  });

  it("does not match an Inactive department unless shown", () => {
    expect(filterOrgTree(roots, { query: "finance" }).length).toBe(1);
    expect(
      shape(filterOrgTree(buildOrgTree([corp[4]]), { query: "finance" })),
    ).toEqual([]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterOrgTree(roots, { query: "sales" })).toEqual([]);
  });
});

describe("indexNodes", () => {
  it("indexes every node of the forest", () => {
    expect([...indexNodes(buildOrgTree(corp)).keys()].sort()).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });
});

describe("expandableIds", () => {
  it("lists the nodes that have children", () => {
    expect(expandableIds(buildOrgTree(corp)).sort()).toEqual([1, 2, 5]);
  });
});

describe("filterTeams", () => {
  const teams = [team(1, "SRE"), team(2, "Design", true), team(3, "Backend")];

  it("hides Inactive teams by default and sorts by display name", () => {
    expect(filterTeams(teams, {}).map((t) => t.id)).toEqual([3, 1]);
    expect(filterTeams(teams, { showInactive: true }).map((t) => t.id)).toEqual(
      [3, 2, 1],
    );
  });

  it("matches the display name or the name", () => {
    expect(filterTeams(teams, { query: "sr" }).map((t) => t.id)).toEqual([1]);
    expect(filterTeams(teams, { query: "team-3" }).map((t) => t.id)).toEqual([
      3,
    ]);
  });
});

describe("orgUnitPathLabel", () => {
  const byId = new Map(corp.map((u) => [u.id, u]));

  it("joins the display names along the path", () => {
    expect(orgUnitPathLabel(corp[2], byId)).toBe(
      "Corp / Engineering / Platform",
    );
  });

  it("skips ancestors the user cannot read", () => {
    const visible = new Map([[3, corp[2]]]);
    expect(orgUnitPathLabel(corp[2], visible)).toBe("Platform");
  });

  it("falls back to the unit's own name without a path", () => {
    expect(orgUnitPathLabel({ ...corp[2], path: "" }, new Map())).toBe(
      "Platform",
    );
  });
});
