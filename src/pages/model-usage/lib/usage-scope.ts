import type { GroupUsageFilter } from "@/domains/api-key/hooks/use-group-usage";
import type { KeyUsageGroup } from "@/domains/api-key/hooks/use-workspace-usage";
import type { ApiUsageRecord, GroupUsageRecord } from "@/domains/api-key/types";
import {
  type OrgTreeNode,
  orgUnitAncestors,
} from "@/domains/organization/lib/org-tree";
import { displayName } from "@/foundation/lib/display-name";
import {
  aggregateSeries,
  modelOf,
  type UsageSeries,
} from "@/pages/model-usage/lib/usage-series";

/** A department with its sub-departments, or a Team. */
export type GroupScope =
  | { type: "orgUnit"; name: string }
  | { type: "team"; name: string; label: string };

/**
 * What the page counts: the whole platform, every application on it, a
 * group, or one user. `from` is the group a user was opened from, so the way
 * back leads there.
 */
export type UsageScope =
  | { type: "platform" }
  | { type: "applications" }
  | GroupScope
  | { type: "user"; id: string; label: string; from: GroupScope | null };

/** A member of the scope's group, listed even without usage. */
export type ScopeMember = { id: string; label: string };

/** The group a scope belongs to: itself, or the group a user was opened from. */
export const groupOf = (scope: UsageScope): GroupScope | null =>
  scope.type === "user"
    ? scope.from
    : scope.type === "platform" || scope.type === "applications"
      ? null
      : scope;

const groupFilter = (group: GroupScope | null): GroupUsageFilter =>
  group?.type === "orgUnit"
    ? { orgUnit: group.name }
    : group?.type === "team"
      ? { team: group.name }
      : {};

/**
 * The get_usage_by_group filter of a scope's User rows. A user opened from a
 * group counts only their usage in that group, as their row there did: in a
 * department, the usage recorded under it directly.
 */
const userUsageFilter = (scope: UsageScope): GroupUsageFilter =>
  scope.type === "user"
    ? {
        name: scope.id,
        ...groupFilter(scope.from),
        ...(scope.from?.type === "orgUnit" ? { direct: true } : {}),
      }
    : groupFilter(groupOf(scope));

/** What the page asks the usage RPCs for in a scope. */
type ScopeQueries = {
  /** The filter of the scope's User rows. Absent when it has none. */
  user?: GroupUsageFilter;
  /**
   * The filter of the scope's ServiceAccount rows: application usage, which
   * is recorded for the application and its Team, under no user and no
   * department. Absent when the scope holds none.
   */
  apps?: GroupUsageFilter;
  /**
   * The filter of the OrgUnit and Team rows. Absent when the scope is not
   * split into departments: a Team, a user, or no scope.
   */
  units?: GroupUsageFilter;
  /**
   * The User rows no child department holds: the platform's usage under no
   * department, or a department's own. Absent when not split into departments.
   */
  direct?: GroupUsageFilter;
  /** The group to narrow usage by API key to. */
  keyGroup?: KeyUsageGroup;
};

export function scopeQueries(scope: UsageScope | null): ScopeQueries {
  switch (scope?.type) {
    case undefined:
      return {};
    case "platform":
      return { user: {}, apps: {}, units: {}, direct: { direct: true } };
    case "applications":
      return { apps: {} };
    case "orgUnit":
      return {
        user: userUsageFilter(scope),
        units: { orgUnit: scope.name },
        direct: { orgUnit: scope.name, direct: true },
        keyGroup: { orgUnit: scope.name },
      };
    case "team":
      return {
        user: userUsageFilter(scope),
        apps: { team: scope.name },
        keyGroup: { team: scope.name },
      };
    case "user":
      return { user: userUsageFilter(scope) };
  }
}

export type ScopeCrumb = { label: string; scope: UsageScope };

/**
 * The way up from a scope: the platform for a reader of every group, then
 * each readable department above, or the Team, then the user.
 */
export function scopeTrail(
  scope: UsageScope | null,
  {
    canReadAllGroups,
    nodesByName,
    nodesById,
    platformLabel,
    applicationsLabel,
  }: {
    canReadAllGroups: boolean;
    nodesByName: ReadonlyMap<string, OrgTreeNode>;
    nodesById: ReadonlyMap<number, OrgTreeNode>;
    platformLabel: string;
    applicationsLabel: string;
  },
): ScopeCrumb[] {
  if (!scope) return [];
  const crumbs: ScopeCrumb[] = canReadAllGroups
    ? [{ label: platformLabel, scope: { type: "platform" } }]
    : [];
  if (scope.type === "applications") {
    crumbs.push({ label: applicationsLabel, scope });
    return crumbs;
  }
  const group = groupOf(scope);
  const groupNode =
    group?.type === "orgUnit" ? nodesByName.get(group.name) : undefined;
  if (groupNode) {
    for (const node of orgUnitAncestors(groupNode, nodesById)) {
      crumbs.push({
        label: node.label,
        scope: { type: "orgUnit", name: node.unit.metadata.name },
      });
    }
  } else if (group?.type === "team") {
    crumbs.push({ label: group.label, scope: group });
  }
  if (scope.type === "user") crumbs.push({ label: scope.label, scope });
  return crumbs;
}

/**
 * The i18n keys that name a scope's breakdown: chart series, tab and column,
 * and who a detail row counts toward. Without a scope or for a user there is
 * no breakdown tab, only the chart.
 */
export function breakdownLabelKeys(scope: UsageScope | null): {
  series: string;
  tab?: string;
  column?: string;
  who: string;
} {
  const user = "model_usage.group.kinds.User";
  const userOrApp = "model_usage.columns.userOrApplication";
  switch (scope?.type) {
    case undefined:
      return { series: "model_usage.series.apiKey", who: "model_usage.apiKey" };
    case "platform":
      return {
        who: userOrApp,
        series: "model_usage.series.department",
        tab: "model_usage.tabs.departments",
        column: "model_usage.group.kinds.OrgUnit",
      };
    case "applications":
      return {
        who: "model_usage.group.kinds.ServiceAccount",
        series: "model_usage.series.application",
        tab: "model_usage.tabs.applications",
        column: "model_usage.group.kinds.ServiceAccount",
      };
    case "team":
      return {
        who: userOrApp,
        series: "model_usage.series.memberOrApplication",
        tab: "model_usage.tabs.membersAndApplications",
        column: "model_usage.columns.memberOrApplication",
      };
    case "orgUnit":
      return {
        who: user,
        series: "model_usage.series.subUnit",
        tab: "model_usage.tabs.subUnits",
        column: "model_usage.columns.subUnitOrUser",
      };
    case "user":
      return { series: "model_usage.series.model", who: user };
  }
}

/** Who a usage row counts toward: a user or group, or an API key. */
export type UsageWho = {
  key: string;
  name: string;
  description: string | null;
};

/**
 * One usage row, whichever RPC returned it. `requests` is absent from usage
 * by API key, which carries no request count.
 */
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
> & { requests?: number; who: UsageWho };

const usageFields = (r: GroupUsageRecord | ApiUsageRecord) => ({
  date: r.date,
  workspace: r.workspace,
  endpoint_type: r.endpoint_type,
  endpoint_name: r.endpoint_name,
  model_name: r.model_name,
  usage: r.usage,
  prompt_tokens: r.prompt_tokens,
  completion_tokens: r.completion_tokens,
});

/** A get_usage_by_group row as a fact of its group. */
export const groupFact = (r: GroupUsageRecord): UsageFact => ({
  ...usageFields(r),
  requests: r.requests,
  who: { key: r.name, name: displayName(r), description: null },
});

/** A get_usage_by_group ServiceAccount row, marked as an application's. */
export const appFact = (r: GroupUsageRecord, label: string): UsageFact => ({
  ...groupFact(r),
  who: { key: r.name, name: displayName(r), description: label },
});

/**
 * A get_usage_by_dimension row as a fact of its API key. A deleted key's rows
 * carry no name: `deletedLabel` names it by the start of its id.
 */
export const keyFact = (
  r: ApiUsageRecord,
  deletedLabel: (shortId: string) => string,
): UsageFact => ({
  ...usageFields(r),
  who: {
    key: r.api_key_id,
    name:
      r.api_key_name === null
        ? deletedLabel(r.api_key_id.slice(0, 8))
        : r.api_key_display_name || r.api_key_name,
    description: r.api_key_description || null,
  },
});

export type UsageTotals = {
  prompt: number;
  completion: number;
  total: number;
  /** Absent when the rows carry no request count (usage by API key). */
  requests?: number;
};

/** The usage of the platform's users that no department holds. */
export const UNASSIGNED_KEY = "__unassigned";

/** The platform's application usage, which no department holds either. */
export const APPLICATIONS_KEY = "__applications";

/** Adds up the rows; `requests` is counted, from 0, only when asked for. */
export function sumUsage(
  rows: UsageFact[],
  countRequests: boolean,
): UsageTotals {
  const totals: UsageTotals = {
    prompt: 0,
    completion: 0,
    total: 0,
    ...(countRequests ? { requests: 0 } : {}),
  };
  for (const r of rows) {
    totals.prompt += r.prompt_tokens ?? 0;
    totals.completion += r.completion_tokens ?? 0;
    totals.total += r.usage ?? 0;
    if (totals.requests !== undefined) totals.requests += r.requests ?? 0;
  }
  return totals;
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
  userRows: UsageFact[];
  /** get_usage_by_group by OrgUnit across the scope (each a subtree total). */
  unitRows: UsageFact[];
  /** By User, recorded under the department itself, or under none. */
  directRows: UsageFact[];
  /** get_usage_by_group by ServiceAccount across the scope. */
  appRows: UsageFact[];
  labels: BreakdownLabels;
};

export type BreakdownLabels = {
  /** The platform's usage under no department. */
  unassigned: string;
  /** The platform's application usage, as one entry. */
  applications: string;
  /** What an application's row is, under its name. */
  application: string;
};

type Entry = Omit<BreakdownFact, keyof UsageFact>;

const unitEntry = (node: OrgTreeNode): Entry => ({
  entry: node.unit.metadata.name,
  label: node.label,
  description: null,
  target: { type: "orgUnit", name: node.unit.metadata.name },
});

const userEntryKey = (id: string) => `user:${id}`;

/** A user's entry in a group's breakdown, which opens the user from there. */
const userEntry = (id: string, label: string, from: GroupScope): Entry => ({
  entry: userEntryKey(id),
  label,
  description: null,
  target: { type: "user", id, label, from },
});

/**
 * Splits a scope's usage into entries that do not overlap:
 * - the platform into its top departments, plus the users' usage in none,
 *   plus its applications;
 * - every application on the platform into each application;
 * - a department into its child departments, plus its direct users;
 * - a Team into its users and its applications;
 * - a user into the models they used.
 * Usage counts toward the department a user was in at the time.
 */
export function buildBreakdown({
  scope,
  nodes,
  roots,
  userRows,
  unitRows,
  directRows,
  appRows,
  labels,
}: BreakdownInput): BreakdownFact[] {
  if (scope.type === "user") {
    return userRows.map((r) => ({
      ...r,
      entry: modelOf(r),
      label: modelOf(r),
      description: null,
      target: null,
    }));
  }

  const byUser = (r: UsageFact, from: GroupScope): BreakdownFact => ({
    ...r,
    ...userEntry(r.who.key, r.who.name, from),
  });

  const byApp = (r: UsageFact): BreakdownFact => ({
    ...r,
    entry: `app:${r.who.key}`,
    label: r.who.name,
    description: r.who.description,
    target: null,
  });

  if (scope.type === "applications") return appRows.map(byApp);

  if (scope.type === "team") {
    return [...userRows.map((r) => byUser(r, scope)), ...appRows.map(byApp)];
  }

  const children =
    scope.type === "platform" ? roots : (nodes.get(scope.name)?.children ?? []);
  const childByName = new Map(
    children.map((node) => [node.unit.metadata.name, node]),
  );
  const units = unitRows.flatMap((r) => {
    const node = childByName.get(r.who.key);
    return node ? [{ ...r, ...unitEntry(node) }] : [];
  });

  if (scope.type === "platform") {
    return [
      ...units,
      ...directRows.map((r) => ({
        ...r,
        entry: UNASSIGNED_KEY,
        label: labels.unassigned,
        description: null,
        target: null,
      })),
      ...appRows.map((r) => ({
        ...r,
        entry: APPLICATIONS_KEY,
        label: labels.applications,
        description: null,
        target: { type: "applications" } as const,
      })),
    ];
  }

  return [...units, ...directRows.map((r) => byUser(r, scope))];
}

/** A breakdown entry with where clicking it leads; null when nowhere. */
type BreakdownSeries = UsageSeries & { target: UsageScope | null };

/**
 * The breakdown's entries, biggest first, then the group's members who used
 * nothing — so a department or Team shows who did not use it too.
 */
export function summarizeBreakdown(
  facts: BreakdownFact[],
  members: ScopeMember[],
  from: GroupScope | null,
): BreakdownSeries[] {
  const series = aggregateSeries(
    facts,
    (r) => r.entry,
    (r) => ({ name: r.label, description: r.description, target: r.target }),
  );
  if (!from) return series;

  const listed = new Set(series.map((s) => s.key));
  const idle = members
    .map((member) => userEntry(member.id, member.label, from))
    .filter((e) => !listed.has(e.entry))
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((e) => ({
      key: e.entry,
      name: e.label,
      description: null,
      prompt: 0,
      completion: 0,
      total: 0,
      requests: 0,
      target: e.target,
    }));
  return [...series, ...idle];
}
