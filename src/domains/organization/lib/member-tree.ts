import type { OrgTreeNode } from "@/domains/organization/lib/org-tree";

export type MemberTreeNode<U> = {
  node: OrgTreeNode;
  children: MemberTreeNode<U>[];
  users: U[];
  /** Every user in this department and its descendants. */
  subtreeUserIds: string[];
};

/**
 * Hangs users under their department. Departments with no user in their
 * subtree are dropped, so a filtered user list keeps only its ancestors.
 */
export function buildMemberTree<U extends { id: string }>(
  roots: OrgTreeNode[],
  users: U[],
  unitIdOfUser: ReadonlyMap<string, number>,
): { roots: MemberTreeNode<U>[]; unassigned: U[] } {
  const byUnit = new Map<number, U[]>();
  const unassigned: U[] = [];
  for (const user of users) {
    const unitId = unitIdOfUser.get(user.id);
    if (unitId === undefined) unassigned.push(user);
    else byUnit.set(unitId, [...(byUnit.get(unitId) ?? []), user]);
  }
  const visit = (node: OrgTreeNode): MemberTreeNode<U> | null => {
    const children = node.children
      .map(visit)
      .filter((child): child is MemberTreeNode<U> => !!child);
    const own = byUnit.get(node.unit.id) ?? [];
    const subtreeUserIds = [
      ...own.map((user) => user.id),
      ...children.flatMap((child) => child.subtreeUserIds),
    ];
    return subtreeUserIds.length
      ? { node, children, users: own, subtreeUserIds }
      : null;
  };
  return {
    roots: roots.map(visit).filter((root): root is MemberTreeNode<U> => !!root),
    unassigned,
  };
}

/** The users of a group that can still be picked, i.e. not yet members. */
const selectableIds = (
  userIds: string[],
  memberIds: ReadonlySet<string>,
) => userIds.filter((id) => !memberIds.has(id));

/** Checkbox state of a group: all, some or none of its selectable users. */
export function groupCheckState(
  userIds: string[],
  memberIds: ReadonlySet<string>,
  selected: ReadonlySet<string>,
): boolean | "indeterminate" {
  const ids = selectableIds(userIds, memberIds);
  if (!ids.length) return true;
  const picked = ids.filter((id) => selected.has(id)).length;
  if (picked === 0) return false;
  return picked === ids.length ? true : "indeterminate";
}

/** Selects, or deselects, every selectable user of a group. */
export function toggleGroup(
  userIds: string[],
  memberIds: ReadonlySet<string>,
  selected: ReadonlySet<string>,
  on: boolean,
): Set<string> {
  const next = new Set(selected);
  for (const id of selectableIds(userIds, memberIds)) {
    if (on) next.add(id);
    else next.delete(id);
  }
  return next;
}
