import { useCallback, useMemo } from "react";
import { useGroupUsage } from "@/domains/api-key/hooks/use-group-usage";
import { useWorkspaceUsage } from "@/domains/api-key/hooks/use-workspace-usage";
import {
  useOrgUnitMembers,
  useTeamMembers,
} from "@/domains/organization/hooks/use-organization";
import type { OrgTreeNode } from "@/domains/organization/lib/org-tree";
import type { Team } from "@/domains/organization/types";
import type { DateRange } from "@/foundation/components/DateRangePicker";
import { profileDisplayName } from "@/foundation/lib/user-identity";
import {
  type BreakdownFact,
  buildBreakdown,
  groupFact,
  groupOf,
  keyFact,
  type ScopeMember,
  scopeQueries,
  subtractUsage,
  summarizeBreakdown,
  sumUsage,
  type UsageFact,
  type UsageScope,
} from "@/pages/model-usage/lib/usage-scope";
import { aggregateSeries, modelOf } from "@/pages/model-usage/lib/usage-series";

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
  unassignedLabel: string;
};

/**
 * The usage of a scope, as every panel of the page shows it. A reader of
 * groups counts by user (each user once), everyone else by API key.
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
  unassignedLabel,
}: ScopeUsageInput) {
  const queries = scopeQueries(scope);
  // Usage by department for the platform and for a department; a Team or a
  // user is not split into departments.
  const unitFilter = queries.units ?? {};
  const childFilters = (
    queries.splitUnit
      ? (nodesByName.get(queries.splitUnit)?.children ?? [])
      : []
  ).map((node) => ({ orgUnit: node.unit.metadata.name, name: queries.userId }));

  const userUsage = useGroupUsage(
    workspace,
    start,
    end,
    "User",
    [queries.user],
    !!scope,
  );
  const unitUsage = useGroupUsage(
    workspace,
    start,
    end,
    "OrgUnit",
    [unitFilter],
    !!queries.units,
  );
  const childUsage = useGroupUsage(workspace, start, end, "User", childFilters);
  const teamUsage = useGroupUsage(
    workspace,
    start,
    end,
    "Team",
    [unitFilter],
    teamsOpen,
  );
  const keyUsage = useWorkspaceUsage(workspace, start, end, !scope || keysOpen);

  const userFacts = useFacts(userUsage.usageData, groupFact);
  const unitFacts = useFacts(unitUsage.usageData, groupFact);
  const childFacts = useFacts(childUsage.usageData, groupFact);
  const teamFacts = useFacts(teamUsage.usageData, groupFact);
  const allKeyFacts = useFacts(keyUsage.usageData, keyFact);

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

  // A user opened from a department counts their usage there less what was
  // recorded in its sub-departments, which the sub-departments' rows hold.
  const subtractChildren = scope?.type === "user" && !!queries.splitUnit;
  const userRows = useMemo(
    () => (subtractChildren ? subtractUsage(userFacts, childFacts) : userFacts),
    [subtractChildren, userFacts, childFacts],
  );
  const scopeRows = scope ? userRows : allKeyFacts;
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
  const facts = useMemo(() => inModel(scopeRows), [inModel, scopeRows]);
  // Usage by group always counts requests, even when there are no rows.
  const totals = useMemo(() => sumUsage(facts, !!scope), [facts, scope]);

  const breakdown = useMemo<BreakdownFact[]>(
    () =>
      scope
        ? buildBreakdown({
            scope,
            nodes: nodesByName,
            roots,
            userRows: inModel(userRows),
            unitRows: inModel(unitFacts),
            childUserRows: inModel(childFacts),
            unassignedLabel,
          })
        : [],
    [
      scope,
      nodesByName,
      roots,
      inModel,
      userRows,
      unitFacts,
      childFacts,
      unassignedLabel,
    ],
  );
  const breakdownSeries = useMemo(
    () => summarizeBreakdown(breakdown, members, group),
    [breakdown, members, group],
  );

  const keyFacts = useMemo(() => inModel(allKeyFacts), [inModel, allKeyFacts]);
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

  const all = [userUsage, unitUsage, childUsage, teamUsage, keyUsage];
  return {
    models,
    scopeTotal,
    facts,
    totals,
    breakdown,
    breakdownSeries,
    keyFacts,
    keyRows,
    teamRows,
    loading: scope
      ? userUsage.isLoading || unitUsage.isLoading || childUsage.isLoading
      : keyUsage.isLoading,
    error: all.find((q) => q.error)?.error,
    refetch: () => {
      for (const q of all) q.refetch();
    },
  };
}
