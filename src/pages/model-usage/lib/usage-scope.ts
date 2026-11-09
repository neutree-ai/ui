import type { GroupUsageFilter } from "@/domains/api-key/hooks/use-group-usage";
import type { GroupUsageRecord } from "@/domains/api-key/types";
import type { OrgTreeNode } from "@/domains/organization/lib/org-tree";
import { EMPTY_VALUE } from "@/foundation/components/EmptyValue";
import {
  aggregateSeries,
  type UsageSeries,
} from "@/pages/model-usage/lib/usage-series";

/** A department with its sub-departments, or a Team. */
export type GroupScope =
  | { type: "orgUnit"; name: string }
  | { type: "team"; name: string; label: string };

/**
 * What the page counts: the whole platform, a group, or one user. `from` is
 * the group a user was opened from, so the way back leads there.
 */
export type UsageScope =
  | { type: "platform" }
  | GroupScope
  | { type: "user"; id: string; label: string; from: GroupScope | null };

/** A member of the scope's group, listed even without usage. */
export type ScopeMember = { id: string; label: string };

/** The group a scope belongs to: itself, or the group a user was opened from. */
export const groupOf = (scope: UsageScope): GroupScope | null =>
  scope.type === "user" ? scope.from : scope.type === "platform" ? null : scope;

const groupFilter = (group: GroupScope | null): GroupUsageFilter =>
  group?.type === "orgUnit"
    ? { orgUnit: group.name }
    : group?.type === "team"
      ? { team: group.name }
      : {};

/**
 * The get_usage_by_group filter of a scope's User rows. A user opened from a
 * group counts only their usage in that group, as their row there did.
 */
export const userUsageFilter = (scope: UsageScope): GroupUsageFilter =>
  scope.type === "user"
    ? { name: scope.id, ...groupFilter(scope.from) }
    : groupFilter(groupOf(scope));

/** The i18n keys that name a scope's breakdown: chart series, tab and column. */
export function breakdownLabelKeys(scope: UsageScope | null): {
  series: string;
  tab: string;
  column: string;
} {
  switch (scope?.type) {
    case undefined:
      return {
        series: "model_usage.series.apiKey",
        tab: "model_usage.tabs.apiKeys",
        column: "model_usage.apiKey",
      };
    case "platform":
      return {
        series: "model_usage.series.department",
        tab: "model_usage.tabs.departments",
        column: "model_usage.group.kinds.OrgUnit",
      };
    case "team":
      return {
        series: "model_usage.series.member",
        tab: "model_usage.tabs.members",
        column: "model_usage.group.kinds.User",
      };
    case "orgUnit":
      return {
        series: "model_usage.series.subUnit",
        tab: "model_usage.tabs.subUnits",
        column: "model_usage.columns.subUnitOrUser",
      };
    case "user":
      return {
        series: "model_usage.series.model",
        tab: "model_usage.tabs.subUnits",
        column: "model_usage.columns.subUnitOrUser",
      };
  }
}

/** The fields every usage row shares, whichever RPC returned it. */
export type UsageFact = Pick<
  GroupUsageRecord,
  | "date"
  | "workspace"
  | "endpoint_type"
  | "endpoint_name"
  | "model_name"
  | "usage"
  | "prompt_tokens"
  | "completion_tokens"
> & { requests?: number };

export type UsageTotals = {
  prompt: number;
  completion: number;
  total: number;
  /** Absent when the rows carry no request count (usage by API key). */
  requests?: number;
};

/** The usage of the platform's users that no department holds. */
export const UNASSIGNED_KEY = "__unassigned";

export function sumUsage(rows: UsageFact[]): UsageTotals {
  const totals: UsageTotals = { prompt: 0, completion: 0, total: 0 };
  for (const r of rows) {
    totals.prompt += r.prompt_tokens ?? 0;
    totals.completion += r.completion_tokens ?? 0;
    totals.total += r.usage ?? 0;
    if (r.requests !== undefined) {
      totals.requests = (totals.requests ?? 0) + r.requests;
    }
  }
  return totals;
}

const factKey = (r: UsageFact, name: string) =>
  [
    name,
    r.date,
    r.workspace,
    r.endpoint_type ?? "",
    r.endpoint_name,
    r.model_name ?? "",
  ].join("\u0000");

/**
 * `rows` with `minus` taken out, matched by date, workspace, endpoint, model
 * and — when `nameOf` is given — by name. Facts that come to nothing are
 * dropped, so a user whose usage is all in sub-departments leaves no row.
 */
export function subtractUsage<R extends UsageFact, M extends UsageFact>(
  rows: R[],
  minus: M[],
  nameOf: (r: R | M) => string = () => "",
): R[] {
  const left = new Map<string, R>();
  for (const r of rows) {
    const key = factKey(r, nameOf(r));
    const prior = left.get(key);
    left.set(
      key,
      prior
        ? {
            ...prior,
            usage: prior.usage + r.usage,
            prompt_tokens: (prior.prompt_tokens ?? 0) + (r.prompt_tokens ?? 0),
            completion_tokens:
              (prior.completion_tokens ?? 0) + (r.completion_tokens ?? 0),
            ...(prior.requests === undefined
              ? {}
              : { requests: prior.requests + (r.requests ?? 0) }),
          }
        : { ...r },
    );
  }
  for (const m of minus) {
    const row = left.get(factKey(m, nameOf(m)));
    if (!row) continue;
    row.usage -= m.usage ?? 0;
    row.prompt_tokens = (row.prompt_tokens ?? 0) - (m.prompt_tokens ?? 0);
    row.completion_tokens =
      (row.completion_tokens ?? 0) - (m.completion_tokens ?? 0);
    if (row.requests !== undefined) row.requests -= m.requests ?? 0;
  }
  return [...left.values()].filter(
    (r) => r.usage > 0 || (r.prompt_tokens ?? 0) > 0 || (r.requests ?? 0) > 0,
  );
}

/**
 * One row of the scope's breakdown: the usage fact and the entry it counts
 * toward. Entries never overlap, so their sum is the scope's total.
 */
export type BreakdownFact = UsageFact & {
  entry: string;
  label: string;
  description: string | null;
  /** Where clicking the entry leads; null when it cannot be opened. */
  target: UsageScope | null;
};

type BreakdownInput = {
  scope: UsageScope;
  /** The tree node of each department by metadata.name. */
  nodes: ReadonlyMap<string, OrgTreeNode>;
  /** The departments shown at the top of the tree. */
  roots: OrgTreeNode[];
  /** get_usage_by_group by User across the scope. */
  userRows: GroupUsageRecord[];
  /** get_usage_by_group by OrgUnit across the scope (each a subtree total). */
  unitRows: GroupUsageRecord[];
  /** By User for each child department of an OrgUnit scope. */
  childUserRows: GroupUsageRecord[];
  unassignedLabel: string;
};

const unitEntry = (r: GroupUsageRecord, node: OrgTreeNode): BreakdownFact => ({
  ...r,
  entry: node.unit.metadata.name,
  label: node.label,
  description: null,
  target: { type: "orgUnit", name: node.unit.metadata.name },
});

/**
 * Splits a scope's usage into entries that do not overlap:
 * - the platform into its top departments, plus the users in none;
 * - a department into its child departments, plus its direct users (its
 *   users' usage less what was recorded in the child departments);
 * - a Team into its users;
 * - a user into the models they used.
 * Usage counts toward the department a user was in at the time.
 */
export function buildBreakdown({
  scope,
  nodes,
  roots,
  userRows,
  unitRows,
  childUserRows,
  unassignedLabel,
}: BreakdownInput): BreakdownFact[] {
  if (scope.type === "user") {
    return userRows.map((r) => ({
      ...r,
      entry: r.model_name ?? EMPTY_VALUE,
      label: r.model_name ?? EMPTY_VALUE,
      description: null,
      target: null,
    }));
  }

  const userEntry = (r: GroupUsageRecord, from: GroupScope) => ({
    ...r,
    entry: `user:${r.name}`,
    label: r.display_name || r.name,
    description: null,
    target: {
      type: "user" as const,
      id: r.name,
      label: r.display_name || r.name,
      from,
    },
  });

  if (scope.type === "team") {
    return userRows.map((r) => userEntry(r, scope));
  }

  const children =
    scope.type === "platform" ? roots : (nodes.get(scope.name)?.children ?? []);
  const childByName = new Map(
    children.map((node) => [node.unit.metadata.name, node]),
  );
  const units = unitRows.flatMap((r) => {
    const node = childByName.get(r.name);
    return node ? [unitEntry(r, node)] : [];
  });

  if (scope.type === "platform") {
    const rest = subtractUsage(userRows, units);
    return [
      ...units,
      ...rest.map((r) => ({
        ...r,
        entry: UNASSIGNED_KEY,
        label: unassignedLabel,
        description: null,
        target: null,
      })),
    ];
  }

  const direct = subtractUsage(userRows, childUserRows, (r) => r.name);
  return [...units, ...direct.map((r) => userEntry(r, scope))];
}

/**
 * The breakdown's entries, biggest first, then the group's members who used
 * nothing — so a department or Team shows who did not use it too — and
 * where each entry leads.
 */
export function summarizeBreakdown(
  facts: BreakdownFact[],
  idleMembers: ScopeMember[],
  from: GroupScope | null,
): { series: UsageSeries[]; targets: Map<string, UsageScope | null> } {
  const series = aggregateSeries(
    facts,
    (r) => r.entry,
    (r) => ({ name: r.label, description: r.description }),
  );
  const targets = new Map(facts.map((r) => [r.entry, r.target]));
  if (!from) return { series, targets };

  const idle = idleMembers
    .filter((member) => !targets.has(`user:${member.id}`))
    .sort((a, b) => a.label.localeCompare(b.label));
  for (const member of idle) {
    const key = `user:${member.id}`;
    series.push({
      key,
      name: member.label,
      description: null,
      prompt: 0,
      completion: 0,
      total: 0,
      requests: 0,
    });
    targets.set(key, {
      type: "user",
      id: member.id,
      label: member.label,
      from,
    });
  }
  return { series, targets };
}
