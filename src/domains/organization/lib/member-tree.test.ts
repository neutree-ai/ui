import { describe, expect, it } from "vitest";
import type { OrgUnit } from "@/domains/organization/types";
import {
  buildMemberTree,
  groupCheckState,
  type MemberTreeNode,
  toggleGroup,
} from "./member-tree";
import { buildOrgTree } from "./org-tree";

const unit = (id: number, path: string, name: string): OrgUnit =>
  ({
    id,
    kind: "OrgUnit",
    metadata: { name, display_name: name },
    spec: { identity_source: "corp", external_id: `x${id}` },
    status: { phase: "Active" },
    path,
  }) as OrgUnit;

// rnd(1) → ml(2) → infer(3); market(4)
const roots = buildOrgTree([
  unit(1, "/1", "rnd"),
  unit(2, "/1/2", "ml"),
  unit(3, "/1/2/3", "infer"),
  unit(4, "/4", "market"),
]);
const user = (id: string) => ({ id });
const unitIdOfUser = new Map([
  ["a", 1],
  ["b", 2],
  ["c", 3],
]);

const shape = (nodes: MemberTreeNode<{ id: string }>[]): unknown[] =>
  nodes.map((n) => [n.node.label, n.users.map((u) => u.id), shape(n.children)]);

describe("buildMemberTree", () => {
  it("hangs users under their department and drops empty ones", () => {
    const tree = buildMemberTree(
      roots,
      ["a", "b", "c", "x"].map(user),
      unitIdOfUser,
    );
    expect(shape(tree.roots)).toEqual([
      ["rnd", ["a"], [["ml", ["b"], [["infer", ["c"], []]]]]],
    ]);
    expect(tree.roots[0].subtreeUserIds).toEqual(["a", "b", "c"]);
    expect(tree.unassigned.map((u) => u.id)).toEqual(["x"]);
  });

  it("keeps only the ancestors of the matching users", () => {
    const tree = buildMemberTree(roots, [user("c")], unitIdOfUser);
    expect(shape(tree.roots)).toEqual([
      ["rnd", [], [["ml", [], [["infer", ["c"], []]]]]],
    ]);
  });
});

describe("subtree selection", () => {
  const ml = buildMemberTree(roots, ["a", "b", "c"].map(user), unitIdOfUser)
    .roots[0].children[0];

  it("selects every user of the subtree but existing members", () => {
    const members = new Set(["c"]);
    const next = toggleGroup(ml.subtreeUserIds, members, new Set(["a"]), true);
    expect([...next].sort()).toEqual(["a", "b"]);
    expect(groupCheckState(ml.subtreeUserIds, members, next)).toBe(true);
  });

  it("deselects the subtree and reports a partial pick", () => {
    const none = new Set<string>();
    const all = new Set(["a", "b", "c"]);
    const next = toggleGroup(ml.subtreeUserIds, none, all, false);
    expect([...next]).toEqual(["a"]);
    expect(groupCheckState(ml.subtreeUserIds, none, new Set(["b"]))).toBe(
      "indeterminate",
    );
    expect(groupCheckState(ml.subtreeUserIds, none, next)).toBe(false);
  });
});
