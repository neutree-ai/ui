import type { OrgUnit, Team } from "@/domains/organization/types";
import { displayName } from "@/foundation/lib/display-name";

export type OrgTreeNode = {
  unit: OrgUnit;
  label: string;
  /** Display names from the topmost visible ancestor down, "A / B / C". */
  pathLabel: string;
  inactive: boolean;
  children: OrgTreeNode[];
};

type OrgTreeGroup = {
  identitySource: string;
  roots: OrgTreeNode[];
};

type OrgTreeFilter = {
  query?: string;
  showInactive?: boolean;
};

export const isInactive = (object: {
  status?: { phase?: string | null } | null;
}) => object.status?.phase === "Inactive";

const pathIds = (path: string) => path.split("/").filter(Boolean).map(Number);

const byLabel = (a: { label: string }, b: { label: string }) =>
  a.label.localeCompare(b.label);

/**
 * "A / B / C": the display names along the OrgUnit's path, skipping the
 * ancestors the user cannot read (absent from unitsById).
 */
export function orgUnitPathLabel(
  unit: OrgUnit,
  unitsById: ReadonlyMap<number, OrgUnit>,
): string {
  const labels = pathIds(unit.path)
    .map((id) => (id === unit.id ? unit : unitsById.get(id)))
    .filter((ancestor): ancestor is OrgUnit => !!ancestor)
    .map((ancestor) => displayName(ancestor.metadata));
  return labels.length ? labels.join(" / ") : displayName(unit.metadata);
}

/**
 * The readable nodes along a node's path, from the top down to the node
 * itself; ancestors the user cannot read (absent from nodesById) are skipped.
 */
export function orgUnitAncestors(
  node: OrgTreeNode,
  nodesById: ReadonlyMap<number, OrgTreeNode>,
): OrgTreeNode[] {
  return pathIds(node.unit.path)
    .map((id) => (id === node.unit.id ? node : nodesById.get(id)))
    .filter((ancestor): ancestor is OrgTreeNode => !!ancestor);
}

/**
 * Builds the department forest from the OrgUnits the user can read. A user
 * bound to a subtree cannot read its ancestors, so a node whose parent is not
 * in the list hangs under its nearest readable ancestor, or becomes a root.
 */
export function buildOrgTree(units: OrgUnit[]): OrgTreeNode[] {
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  const nodes = new Map<number, OrgTreeNode>();

  for (const unit of units) {
    nodes.set(unit.id, {
      unit,
      label: displayName(unit.metadata),
      pathLabel: orgUnitPathLabel(unit, unitsById),
      inactive: isInactive(unit),
      children: [],
    });
  }

  const roots: OrgTreeNode[] = [];
  for (const node of nodes.values()) {
    const ancestors = pathIds(node.unit.path).slice(0, -1).reverse();
    const parentId = ancestors.find((id) => nodes.has(id));
    const parent = parentId === undefined ? undefined : nodes.get(parentId);
    (parent ? parent.children : roots).push(node);
  }

  const sort = (list: OrgTreeNode[]) => {
    list.sort(byLabel);
    for (const node of list) sort(node.children);
  };
  sort(roots);
  return roots;
}

/** Splits the forest by the identity source each tree was synced from. */
export function groupByIdentitySource(roots: OrgTreeNode[]): OrgTreeGroup[] {
  const groups = new Map<string, OrgTreeNode[]>();
  for (const root of roots) {
    const source = root.unit.spec.identity_source;
    const list = groups.get(source);
    if (list) list.push(root);
    else groups.set(source, [root]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([identitySource, groupRoots]) => ({
      identitySource,
      roots: groupRoots,
    }));
}

/**
 * Keeps the nodes whose path matches the query (case-insensitive) and, unless
 * showInactive, that are Active. A node that fails is still kept, as context,
 * when one of its descendants passes.
 */
export function filterOrgTree(
  roots: OrgTreeNode[],
  { query = "", showInactive = false }: OrgTreeFilter,
): OrgTreeNode[] {
  const needle = query.trim().toLowerCase();
  const visit = (node: OrgTreeNode): OrgTreeNode | null => {
    const children = node.children
      .map(visit)
      .filter((child): child is OrgTreeNode => !!child);
    const passes =
      (showInactive || !node.inactive) &&
      (!needle || node.pathLabel.toLowerCase().includes(needle));
    return passes || children.length ? { ...node, children } : null;
  };
  return roots.map(visit).filter((node): node is OrgTreeNode => !!node);
}

/** Ids of every node that has children, to expand the whole tree. */
export function expandableIds(roots: OrgTreeNode[]): number[] {
  return roots.flatMap((node) =>
    node.children.length ? [node.unit.id, ...expandableIds(node.children)] : [],
  );
}

/** Every node of the forest by OrgUnit id. */
export function indexNodes(
  roots: OrgTreeNode[],
  index = new Map<number, OrgTreeNode>(),
): Map<number, OrgTreeNode> {
  for (const node of roots) {
    index.set(node.unit.id, node);
    indexNodes(node.children, index);
  }
  return index;
}

/** Teams sorted by display name, filtered like filterOrgTree. */
export function filterTeams(
  teams: Team[],
  { query = "", showInactive = false }: OrgTreeFilter,
): Team[] {
  const needle = query.trim().toLowerCase();
  return teams
    .filter(
      (team) =>
        (showInactive || !isInactive(team)) &&
        (!needle ||
          displayName(team.metadata).toLowerCase().includes(needle) ||
          team.metadata.name.toLowerCase().includes(needle)),
    )
    .sort((a, b) =>
      displayName(a.metadata).localeCompare(displayName(b.metadata)),
    );
}

type OrgTreeIndex = {
  roots: OrgTreeNode[];
  byId: ReadonlyMap<number, OrgTreeNode>;
  byName: ReadonlyMap<string, OrgTreeNode>;
};

// Keyed by the cached rows, so every consumer of one fetch shares one index.
const orgTreeIndexes = new WeakMap<OrgUnit[], OrgTreeIndex>();

/** The forest with lookups; built once per fetched list. */
export const orgTreeIndex = (units: OrgUnit[]): OrgTreeIndex => {
  let index = orgTreeIndexes.get(units);
  if (!index) {
    const roots = buildOrgTree(units);
    const byId = indexNodes(roots);
    index = {
      roots,
      byId,
      byName: new Map(
        [...byId.values()].map((node) => [node.unit.metadata.name, node]),
      ),
    };
    orgTreeIndexes.set(units, index);
  }
  return index;
};

type TeamIndex = { list: Team[]; byName: ReadonlyMap<string, Team> };

const teamIndexes = new WeakMap<Team[], TeamIndex>();

/** Teams, Active first then by display name; built once per fetched list. */
export const teamIndex = (teams: Team[]): TeamIndex => {
  let index = teamIndexes.get(teams);
  if (!index) {
    const list = [...teams].sort(
      (a, b) =>
        Number(isInactive(a)) - Number(isInactive(b)) ||
        displayName(a.metadata).localeCompare(displayName(b.metadata)),
    );
    index = {
      list,
      byName: new Map(list.map((team) => [team.metadata.name, team])),
    };
    teamIndexes.set(teams, index);
  }
  return index;
};
