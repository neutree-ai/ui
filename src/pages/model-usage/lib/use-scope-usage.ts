import { useCallback, useMemo, useRef } from "react";
import { useGroupUsage } from "@/domains/api-key/hooks/use-group-usage";
import { useWorkspaceUsage } from "@/domains/api-key/hooks/use-workspace-usage";
import type { ApiUsageRecord, GroupUsageRecord } from "@/domains/api-key/types";
import {
  useOrgUnitMembers,
  useTeamMembers,
} from "@/domains/organization/hooks/use-organization";
import type { OrgTreeNode } from "@/domains/organization/lib/org-tree";
import type { Team } from "@/domains/organization/types";
import type { DateRange } from "@/foundation/components/DateRangePicker";
import { profileDisplayName } from "@/foundation/lib/user-identity";
import {
  appFact,
  type BreakdownFact,
  type BreakdownLabels,
  buildBreakdown,
  groupFact,
  groupOf,
  keyFact,
  type ScopeMember,
  scopeQueries,
  summarizeBreakdown,
  sumUsage,
  type UsageFact,
  type UsageScope,
} from "@/pages/model-usage/lib/usage-scope";
import {
  aggregateSeries,
  modelOf,
  previousRange,
} from "@/pages/model-usage/lib/usage-series";

const modelMeta = (r: UsageFact) => ({ name: modelOf(r), description: null });
const whoMeta = (r: UsageFact) => ({
  name: r.who.name,
  description: r.who.description,
});

const teamTarget = (r: UsageFact): UsageScope => ({
  type: "team",
  name: r.who.key,
  label: r.who.name,
});

const useFacts = <R>(rows: R[], toFact: (r: R) => UsageFact) =>
  useMemo(() => rows.map(toFact), [rows, toFact]);

/**
 * The usage of a scope's users and of its applications in one range. Each
 * is fetched only when the scope has it; otherwise it is no query at all, so
 * no cached rows of another scope can stand in for it.
 */
const useSubjectUsage = (
  workspace: string,
  { start, end }: DateRange,
  queries: ReturnType<typeof scopeQueries>,
) => ({
  users: useGroupUsage(
    workspace,
    start,
    end,
    "User",
    queries.user ? [queries.user] : [],
  ),
  apps: useGroupUsage(
    workspace,
    start,
    end,
    "ServiceAccount",
    queries.apps ? [queries.apps] : [],
  ),
});

type ScopeUsageInput = {
  workspace: string;
  range: DateRange;
  /** The model filter; empty for every model. */
  model: string;
  /** Null for a reader of their own API keys only. */
  scope: UsageScope | null;
  /** Whether the Teams tab and the API keys tab are open: only then fetched. */
  teamsOpen: boolean;
  keysOpen: boolean;
  roots: OrgTreeNode[];
  nodesByName: ReadonlyMap<string, OrgTreeNode>;
  teamsByName: ReadonlyMap<string, Team>;
  breakdownLabels: BreakdownLabels;
  /** Names a deleted API key by the start of its id. Keep it stable. */
  deletedKeyLabel: (shortId: string) => string;
};

/**
 * The usage of a scope, as every panel of the page shows it. A reader of
 * groups counts by user (each user once) and by application, everyone else
 * by API key.
 */
export function useScopeUsage({
  workspace,
  range: { start, end },
  model,
  scope,
  teamsOpen,
  keysOpen,
  roots,
  nodesByName,
  teamsByName,
  breakdownLabels,
  deletedKeyLabel,
}: ScopeUsageInput) {
  const queries = scopeQueries(scope);
  // Usage by department for the platform and for a department; a Team or a
  // user is not split into departments.
  const unitFilter = queries.units ?? {};

  const { users: userUsage, apps: appUsage } = useSubjectUsage(
    workspace,
    { start, end },
    queries,
  );
  const unitUsage = useGroupUsage(
    workspace,
    start,
    end,
    "OrgUnit",
    queries.units ? [queries.units] : [],
  );
  const directUsage = useGroupUsage(
    workspace,
    start,
    end,
    "User",
    queries.direct ? [queries.direct] : [],
  );
  const teamUsage = useGroupUsage(
    workspace,
    start,
    end,
    "Team",
    [unitFilter],
    teamsOpen,
  );
  const keyUsage = useWorkspaceUsage(
    workspace,
    start,
    end,
    !scope || keysOpen,
    queries.keyGroup,
  );

  // The previous period of the same length, for the total's change. Only
  // the scope's own rows are needed: users and applications, or API keys.
  const previous = previousRange({ start, end });
  const { users: prevUserUsage, apps: prevAppUsage } = useSubjectUsage(
    workspace,
    previous,
    queries,
  );
  const prevKeyUsage = useWorkspaceUsage(
    workspace,
    previous.start,
    previous.end,
    !scope,
  );

  const userFacts = useFacts(userUsage.usageData, groupFact);
  const appFactOf = useCallback(
    (r: GroupUsageRecord) => appFact(r, breakdownLabels.application),
    [breakdownLabels.application],
  );
  const appFacts = useFacts(appUsage.usageData, appFactOf);
  const unitFacts = useFacts(unitUsage.usageData, groupFact);
  const directFacts = useFacts(directUsage.usageData, groupFact);
  const teamFacts = useFacts(teamUsage.usageData, groupFact);
  const keyFactOf = useCallback(
    (r: ApiUsageRecord) => keyFact(r, deletedKeyLabel),
    [deletedKeyLabel],
  );
  const allKeyFacts = useFacts(keyUsage.usageData, keyFactOf);
  const prevUserFacts = useFacts(prevUserUsage.usageData, groupFact);
  const prevAppFacts = useFacts(prevAppUsage.usageData, groupFact);
  const prevKeyFacts = useFacts(prevKeyUsage.usageData, keyFactOf);

  // The group's current members, so the breakdown lists those who used
  // nothing too. A department lists its direct members only: the members of
  // its sub-departments are counted in their department's row.
  const group = scope ? groupOf(scope) : null;
  const memberUnit = scope?.type === "orgUnit" ? scope.name : undefined;
  const memberTeam = scope?.type === "team" ? scope.name : undefined;
  const unitMembers = useOrgUnitMembers(
    memberUnit ? nodesByName.get(memberUnit)?.unit.id : undefined,
    false,
  );
  const teamMembers = useTeamMembers(
    memberTeam ? teamsByName.get(memberTeam)?.id : undefined,
  );
  const members = useMemo<ScopeMember[]>(
    () =>
      (memberUnit ? unitMembers.members : memberTeam ? teamMembers.members : [])
        .filter((member) => member.user_profiles)
        .map((member) => ({
          id: member.user_id,
          // biome-ignore lint/style/noNonNullAssertion: filtered above
          label: profileDisplayName(member.user_profiles!.metadata),
        })),
    [memberUnit, memberTeam, unitMembers.members, teamMembers.members],
  );

  const scopeRows = useMemo(
    () => (scope ? [...userFacts, ...appFacts] : allKeyFacts),
    [scope, userFacts, appFacts, allKeyFacts],
  );
  const models = useMemo(
    () => aggregateSeries(scopeRows, modelOf, modelMeta),
    [scopeRows],
  );
  const scopeTotal = useMemo(
    () => models.reduce((sum, m) => sum + m.total, 0),
    [models],
  );

  const inModel = useCallback(
    (rows: UsageFact[]) =>
      model ? rows.filter((r) => modelOf(r) === model) : rows,
    [model],
  );
  const userIn = useMemo(() => inModel(userFacts), [inModel, userFacts]);
  const appIn = useMemo(() => inModel(appFacts), [inModel, appFacts]);
  const keyFacts = useMemo(() => inModel(allKeyFacts), [inModel, allKeyFacts]);
  const facts = useMemo(
    () => (scope ? [...userIn, ...appIn] : keyFacts),
    [scope, userIn, appIn, keyFacts],
  );
  // Usage by group always counts requests, even when there are no rows.
  const totals = useMemo(() => sumUsage(facts, !!scope), [facts, scope]);
  // Who made the usage: users and applications with any in the range.
  const activity = useMemo(() => {
    if (!scope) return null;
    const used = (rows: UsageFact[]) =>
      new Set(rows.map((r) => r.who.key)).size;
    return { users: used(userIn), applications: used(appIn) };
  }, [scope, userIn, appIn]);

  // Counted as this period's total is: the same rows, the same model filter.
  const prevQueries = scope ? [prevUserUsage, prevAppUsage] : [prevKeyUsage];
  const prevSettled = !prevQueries.some(
    (q) => q.isPlaceholder || q.error || (q.isLoading && !q.usageData.length),
  );
  const previousTotal = useMemo(
    () =>
      prevSettled
        ? sumUsage(
            inModel(scope ? [...prevUserFacts, ...prevAppFacts] : prevKeyFacts),
            false,
          ).total
        : null,
    [prevSettled, scope, inModel, prevUserFacts, prevAppFacts, prevKeyFacts],
  );

  const breakdown = useMemo<BreakdownFact[]>(
    () =>
      scope
        ? buildBreakdown({
            scope,
            nodes: nodesByName,
            roots,
            userRows: userIn,
            unitRows: inModel(unitFacts),
            directRows: inModel(directFacts),
            appRows: appIn,
            labels: breakdownLabels,
          })
        : [],
    [
      scope,
      nodesByName,
      roots,
      inModel,
      userIn,
      unitFacts,
      directFacts,
      appIn,
      breakdownLabels,
    ],
  );
  const breakdownSeries = useMemo(
    () => summarizeBreakdown(breakdown, members, group),
    [breakdown, members, group],
  );

  const keyRows = useMemo(
    () => aggregateSeries(keyFacts, (r) => r.who.key, whoMeta),
    [keyFacts],
  );
  const teamRows = useMemo(
    () =>
      aggregateSeries(
        inModel(teamFacts),
        (r) => r.who.key,
        (r) => ({ ...whoMeta(r), target: teamTarget(r) }),
      ),
    [inModel, teamFacts],
  );

  // Rows of different params must never be combined: the total and the
  // breakdown would count different scopes. While any query still holds the
  // rows of its previous params, the last result whose rows all answered the
  // same params stays on screen.
  const all = [
    userUsage,
    appUsage,
    unitUsage,
    directUsage,
    teamUsage,
    keyUsage,
  ];
  const settled = !all.some((q) => q.isPlaceholder);
  const view = {
    models,
    scopeTotal,
    facts,
    totals,
    activity,
    breakdown,
    breakdownSeries,
    keyFacts,
    keyRows,
    teamRows,
  };
  const lastSettled = useRef<typeof view | null>(null);
  if (settled) lastSettled.current = view;
  const shown = settled
    ? view
    : (lastSettled.current ?? {
        models: [],
        scopeTotal: 0,
        facts: [],
        totals: sumUsage([], !!scope),
        activity: null,
        breakdown: [],
        breakdownSeries: [],
        keyFacts: [],
        keyRows: [],
        teamRows: [],
      });

  return {
    ...shown,
    // Null until the previous period is in, or when the page is between
    // results: the change would compare different scopes.
    previousTotal: settled ? previousTotal : null,
    loading:
      !settled ||
      (scope
        ? userUsage.isLoading ||
          appUsage.isLoading ||
          unitUsage.isLoading ||
          directUsage.isLoading
        : keyUsage.isLoading),
    error: all.find((q) => q.error)?.error,
    refetch: () => {
      for (const q of all) q.refetch();
    },
  };
}
