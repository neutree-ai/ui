import { useParsed } from "@refinedev/core";
import { RefreshCw } from "lucide-react";
import { Fragment, useCallback, useMemo, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiKeyLabel } from "@/domains/api-key/components/ApiKeyLabel";
import {
  useGroupUsage,
  useGroupUsageInUnits,
} from "@/domains/api-key/hooks/use-group-usage";
import { useWorkspaceUsage } from "@/domains/api-key/hooks/use-workspace-usage";
import type { ApiUsageRecord, GroupUsageRecord } from "@/domains/api-key/types";
import {
  useOrgTree,
  useOrgUnitMembers,
  useTeamMembers,
  useTeamsByName,
} from "@/domains/organization/hooks/use-organization";
import { orgUnitAncestors } from "@/domains/organization/lib/org-tree";
import {
  type DateRange,
  DateRangePicker,
  formatRangeLabel,
  trailingRange,
} from "@/foundation/components/DateRangePicker";
import { EMPTY_VALUE } from "@/foundation/components/EmptyValue";
import { ListPage } from "@/foundation/components/ListPage";
import {
  useHasGlobalPermission,
  useHasPermission,
} from "@/foundation/hooks/use-has-permission";
import { useTranslation } from "@/foundation/lib/i18n";
import { profileDisplayName } from "@/foundation/lib/user-identity";
import { cn } from "@/foundation/lib/utils";
import { UsageChart } from "@/pages/model-usage/components/UsageChart";
import {
  ModelShare,
  UsageSummary,
} from "@/pages/model-usage/components/UsageOverview";
import { UsageScopePanel } from "@/pages/model-usage/components/UsageScopePanel";
import {
  DetailTable,
  UsageTable,
} from "@/pages/model-usage/components/UsageTables";
import {
  type BreakdownFact,
  breakdownLabelKeys,
  buildBreakdown,
  groupOf,
  type ScopeMember,
  subtractUsage,
  summarizeBreakdown,
  sumUsage,
  type UsageFact,
  type UsageScope,
  userUsageFilter,
} from "@/pages/model-usage/lib/usage-scope";
import {
  aggregateSeries,
  buildTrend,
  foldRemainder,
} from "@/pages/model-usage/lib/usage-series";

const RANGE_PRESETS = [7, 30, 90];
// The window the page opens on, and the fallback when nothing else was picked.
const DEFAULT_RANGE_DAYS = 30;
// How many entries get their own line/bar before the rest folds into "other".
// It bounds the tooltip row count: at 8 the tooltip is ~200px inside the 240px
// chart card, and every extra series pushes it closer to spilling out.
const TOP_K = 8;
// The model filter's "every model" value.
const ALL_MODELS = "__all__";
const PLATFORM: UsageScope = { type: "platform" };

type Tab = "breakdown" | "team" | "apiKey" | "model" | "detail";

const modelOf = (r: { model_name: string | null }) =>
  r.model_name ?? EMPTY_VALUE;
const modelMeta = (r: { model_name: string | null }) => ({
  name: modelOf(r),
  description: null,
});
const keyMeta = (r: ApiUsageRecord) => ({
  name: r.api_key_display_name || r.api_key_name || r.api_key_id,
  description: r.api_key_description || null,
});

export const ModelUsageList = () => {
  const { t } = useTranslation();
  const { params } = useParsed();
  const workspace = (params?.workspace as string) ?? "";

  const [range, setRange] = useState<DateRange>(() =>
    trailingRange(DEFAULT_RANGE_DAYS),
  );
  const [model, setModel] = useState("");
  // The breakdown's entries never overlap, so a stacked bar shows the scope's
  // daily total and who made it up at once.
  const [chartType, setChartType] = useState<"line" | "bar">("bar");
  // Series toggled off via the (clickable) chart legend.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  // The range to come back to after drilling into a day, so the way back is
  // whatever the reader was looking at — a preset or their own custom window.
  const [lastRange, setLastRange] = useState<DateRange | null>(null);
  const [pickedTab, setTab] = useState<Tab>("breakdown");

  // Usage by group includes other users' usage: a global workspace:usage-read
  // reads the whole platform, org_unit:usage-read the departments the caller
  // manages. Everyone else sees the usage of the API keys they can read.
  const canReadAllGroups =
    useHasGlobalPermission("workspace:usage-read").allowed === true;
  const canReadSubtree =
    useHasPermission("org_unit:usage-read").allowed === true;
  const canReadGroups = canReadAllGroups || canReadSubtree;

  const {
    roots,
    byId: nodesById,
    byName: nodesByName,
  } = useOrgTree(canReadGroups);
  // Teams are a scope of their own for a global reader only: the RPC refuses
  // usage by Team to everyone else.
  const { list: teamList, byName: teamsByName } =
    useTeamsByName(canReadAllGroups);

  // The page opens on the whole platform, or on the first department of a
  // department admin; null is a reader of their own keys only.
  const [pickedScope, setPickedScope] = useState<UsageScope | null>(null);
  const firstRoot = roots[0]?.unit.metadata.name;
  // Memoized: the scope keys the page's heavier memos.
  const defaultScope = useMemo<UsageScope | null>(
    () =>
      canReadAllGroups
        ? PLATFORM
        : firstRoot
          ? { type: "orgUnit", name: firstRoot }
          : null,
    [canReadAllGroups, firstRoot],
  );
  const scope = canReadGroups ? (pickedScope ?? defaultScope) : null;
  const changeScope = useCallback((next: UsageScope) => {
    setPickedScope(next);
    setHidden(new Set());
  }, []);

  const scopeUnit = scope?.type === "orgUnit" ? scope.name : undefined;
  const scopeTeam = scope?.type === "team" ? scope.name : undefined;
  const groupScope =
    scope?.type === "orgUnit" || scope?.type === "team" ? scope : null;
  // A user opened from a department counts their usage there less what was
  // recorded in its sub-departments, which the sub-departments' rows hold.
  const userFrom = scope?.type === "user" ? scope.from : null;
  const userId = scope?.type === "user" ? scope.id : undefined;
  const splitUnit =
    scopeUnit ?? (userFrom?.type === "orgUnit" ? userFrom.name : undefined);
  // useGroupUsage keys its request on the filter's fields, so these need no memo.
  const userFilter = scope ? userUsageFilter(scope) : {};
  const unitFilter = scopeUnit ? { orgUnit: scopeUnit } : {};
  const childUnits = useMemo(
    () =>
      splitUnit
        ? (nodesByName.get(splitUnit)?.children ?? []).map(
            (node) => node.unit.metadata.name,
          )
        : [],
    [splitUnit, nodesByName],
  );
  const groupWorkspace = scope ? workspace : undefined;
  // Usage by department for the platform and for a department; a Team or a
  // user is not split into departments.
  const departmentWorkspace =
    scope?.type === "platform" || scope?.type === "orgUnit"
      ? workspace
      : undefined;

  const userUsage = useGroupUsage(
    groupWorkspace,
    range.start,
    range.end,
    "User",
    userFilter,
  );
  const unitUsage = useGroupUsage(
    departmentWorkspace,
    range.start,
    range.end,
    "OrgUnit",
    unitFilter,
  );
  const childUsage = useGroupUsageInUnits(
    splitUnit ? workspace : undefined,
    range.start,
    range.end,
    "User",
    childUnits,
    userId,
  );

  // The group's current members, so the breakdown lists those who used
  // nothing too. A department lists its direct members only: the members of
  // its sub-departments are counted in their department's row.
  const unitMembers = useOrgUnitMembers(
    scopeUnit ? nodesByName.get(scopeUnit)?.unit.id : undefined,
    false,
  );
  const teamMembers = useTeamMembers(
    scopeTeam ? teamsByName.get(scopeTeam)?.id : undefined,
  );
  const members = useMemo<ScopeMember[]>(
    () =>
      (scopeUnit ? unitMembers.members : scopeTeam ? teamMembers.members : [])
        .filter((member) => member.user_profiles)
        .map((member) => ({
          id: member.user_id,
          // biome-ignore lint/style/noNonNullAssertion: filtered above
          label: profileDisplayName(member.user_profiles!.metadata),
        })),
    [scopeUnit, scopeTeam, unitMembers.members, teamMembers.members],
  );

  // The tabs this scope has. API keys carry no department, so they are only
  // counted for the whole platform; Teams need a global reader.
  const tabs = useMemo<Tab[]>(() => {
    if (!scope) return ["apiKey", "model", "detail"];
    if (scope.type === "user") return ["model", "detail"];
    if (scope.type === "team") return ["breakdown", "model", "detail"];
    return [
      "breakdown",
      ...(canReadAllGroups ? (["team"] as const) : []),
      ...(scope.type === "platform" && canReadAllGroups
        ? (["apiKey"] as const)
        : []),
      "model",
      "detail",
    ];
  }, [scope, canReadAllGroups]);
  const tab = tabs.includes(pickedTab) ? pickedTab : tabs[0];

  const teamUsage = useGroupUsage(
    tab === "team" ? departmentWorkspace : undefined,
    range.start,
    range.end,
    "Team",
    unitFilter,
  );
  const keyUsage = useWorkspaceUsage(
    !scope || tab === "apiKey" ? workspace : undefined,
    range.start,
    range.end,
  );

  // Picking a day in the chart narrows the range itself to that day — there is
  // no second "focused day" state, so every panel on the page follows the same
  // scope and the date control is both the state and the way back.
  const isSingleDay = range.start === range.end;

  const changeRange = useCallback((next: DateRange) => {
    setRange(next);
    // Remember where to come back to. A single day picked in the calendar is
    // itself a drill-down, so it is not a place to come back to.
    if (next.start !== next.end) setLastRange(next);
  }, []);

  const pickDay = useCallback(
    (day: string) => {
      setLastRange((previous) =>
        range.start === range.end ? previous : range,
      );
      setRange({ start: day, end: day });
    },
    [range],
  );

  const resetRange = useCallback(
    () => setRange(lastRange ?? trailingRange(DEFAULT_RANGE_DAYS)),
    [lastRange],
  );

  // "Back to last 30 days" when the previous range was a preset, otherwise name
  // the window the reader picked themselves.
  const backLabel = useMemo(() => {
    const target = lastRange ?? trailingRange(DEFAULT_RANGE_DAYS);
    const preset = RANGE_PRESETS.find((days) => {
      const candidate = trailingRange(days);
      return candidate.start === target.start && candidate.end === target.end;
    });
    return preset
      ? t("model_usage.daily.backToPreset", { days: preset })
      : t("model_usage.daily.backToRange", {
          range: formatRangeLabel(target),
        });
  }, [lastRange, t]);

  // Every number on the page is the scope's: by user for a reader of groups
  // (each user counts once), by API key for everyone else.
  const userRows = useMemo(
    () =>
      userFrom?.type === "orgUnit"
        ? subtractUsage(userUsage.usageData, childUsage.usageData)
        : userUsage.usageData,
    [userFrom, userUsage.usageData, childUsage.usageData],
  );
  const scopeRows: UsageFact[] = scope ? userRows : keyUsage.usageData;
  const models = useMemo(
    () => aggregateSeries(scopeRows, modelOf, modelMeta),
    [scopeRows],
  );
  const scopeTotal = useMemo(
    () => models.reduce((sum, m) => sum + m.total, 0),
    [models],
  );

  const inModel = useCallback(
    <R extends { model_name: string | null }>(rows: R[]) =>
      model ? rows.filter((r) => modelOf(r) === model) : rows,
    [model],
  );
  const facts = useMemo(() => inModel(scopeRows), [inModel, scopeRows]);
  // Usage by group always counts requests, even when there are no rows.
  const totals = useMemo(
    () => (scope ? { requests: 0, ...sumUsage(facts) } : sumUsage(facts)),
    [scope, facts],
  );

  const childRowsLoading =
    userUsage.isLoading || unitUsage.isLoading || childUsage.isLoading;
  const breakdown = useMemo<BreakdownFact[]>(() => {
    if (!scope) return [];
    return buildBreakdown({
      scope,
      nodes: nodesByName,
      roots,
      userRows: inModel(userRows),
      unitRows: inModel(unitUsage.usageData),
      childUserRows: inModel(childUsage.usageData),
      unassignedLabel: t("model_usage.scope.unassigned"),
    });
  }, [
    scope,
    nodesByName,
    roots,
    inModel,
    userRows,
    unitUsage.usageData,
    childUsage.usageData,
    t,
  ]);
  const { series: breakdownSeries, targets } = useMemo(
    () => summarizeBreakdown(breakdown, members, groupScope),
    [breakdown, members, groupScope],
  );

  // The chart splits the scope like the first tab: departments and users,
  // a user's models, or a key reader's API keys.
  const keyFacts = useMemo(
    () => inModel(keyUsage.usageData),
    [inModel, keyUsage.usageData],
  );
  const keyRows = useMemo(
    () => aggregateSeries(keyFacts, (r) => r.api_key_id, keyMeta),
    [keyFacts],
  );
  const chart = useMemo(() => {
    if (scope) {
      // Members without usage have nothing to draw.
      const series = foldRemainder(
        breakdownSeries.filter((s) => s.total > 0),
        TOP_K,
        (count) => t("model_usage.daily.otherGroups", { n: count }),
      );
      return {
        series,
        trend: buildTrend(breakdown, series, (r) => r.entry),
      };
    }
    const series = foldRemainder(keyRows, TOP_K, (count) =>
      t("model_usage.daily.otherKeys", { n: count }),
    );
    return {
      series,
      trend: buildTrend(keyFacts, series, (r) => r.api_key_id),
    };
  }, [scope, breakdownSeries, breakdown, keyRows, keyFacts, t]);
  const labelKeys = breakdownLabelKeys(scope);

  const teamRows = useMemo(
    () =>
      aggregateSeries(
        inModel(teamUsage.usageData),
        (r: GroupUsageRecord) => r.name,
        (r) => ({ name: r.display_name || r.name, description: null }),
      ),
    [inModel, teamUsage.usageData],
  );
  const modelRows = useMemo(
    () => (model ? models.filter((m) => m.key === model) : models),
    [model, models],
  );
  const detailRows = useMemo(
    () =>
      [...facts].sort(
        (a, b) =>
          b.date.localeCompare(a.date) || (b.usage ?? 0) - (a.usage ?? 0),
      ),
    [facts],
  );

  // The way up from the scope: the platform, then each department above.
  const trail = useMemo(() => {
    if (!scope) return [];
    const crumbs: { label: string; scope: UsageScope }[] = canReadAllGroups
      ? [
          {
            label: t("model_usage.scope.platform"),
            scope: { type: "platform" },
          },
        ]
      : [];
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
  }, [scope, canReadAllGroups, nodesByName, nodesById, t]);

  // The tables reset to page 1 when the scope changes — and only then. The
  // usage RPC polls every minute and hands back new arrays, which must not
  // throw the reader back to page 1.
  const scopeKey = [
    range.start,
    range.end,
    model,
    scope ? JSON.stringify(scope) : "",
  ].join("|");

  const onToggleSeries = (key: string) => {
    if (!key) return;
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const loading = scope ? childRowsLoading : keyUsage.isLoading;
  const queries = [userUsage, unitUsage, childUsage, teamUsage, keyUsage];
  const error = queries.find((q) => q.error)?.error;

  const tabLabel: Record<Tab, string> = {
    breakdown: t(labelKeys.tab),
    team: t("model_usage.tabs.teams"),
    apiKey: t("model_usage.tabs.apiKeys"),
    model: t("model_usage.tabs.models"),
    detail: t("model_usage.tabs.detail"),
  };

  const content = (
    <div className="min-w-0 space-y-4">
      {trail.length > 1 ? (
        <Breadcrumb aria-label={t("model_usage.scope.title")}>
          <BreadcrumbList>
            {trail.map((crumb, index) => (
              <Fragment key={JSON.stringify(crumb.scope)}>
                {index > 0 ? <BreadcrumbSeparator /> : null}
                <BreadcrumbItem>
                  {index === trail.length - 1 ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <button
                        type="button"
                        onClick={() => changeScope(crumb.scope)}
                      >
                        {crumb.label}
                      </button>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}

      <UsageSummary totals={totals} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <UsageChart
          series={chart.series}
          trendData={chart.trend}
          dayCategories={isSingleDay ? chart.series : []}
          isSingleDay={isSingleDay}
          seriesLabel={t(labelKeys.series)}
          chartType={chartType}
          onChartTypeChange={setChartType}
          hidden={hidden}
          onToggleSeries={onToggleSeries}
          isLoading={loading}
          backLabel={backLabel}
          onPickDay={pickDay}
          onResetRange={resetRange}
        />
        <ModelShare
          models={models}
          total={scopeTotal}
          selected={model}
          onSelect={setModel}
        />
      </div>

      {error ? (
        <div className="text-sm text-destructive">{error.message}</div>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="overflow-hidden rounded-[var(--nt-radius-card)] border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)]"
      >
        <div className="border-b border-[var(--nt-stroke-neutral-trans-2)] px-3 py-2">
          <TabsList>
            {tabs.map((value) => (
              <TabsTrigger key={value} value={value}>
                {tabLabel[value]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="breakdown" className="mt-0">
          <UsageTable
            nameHeader={t(labelKeys.column)}
            rows={breakdownSeries}
            resetKey={scopeKey}
            total={totals.total}
            showRequests
            canOpen={(r) => !!targets.get(r.key)}
            onOpen={(r) => {
              const target = targets.get(r.key);
              if (target) changeScope(target);
            }}
          />
        </TabsContent>
        <TabsContent value="team" className="mt-0">
          <p className="px-4 pt-3 text-xs text-muted-foreground">
            {t("model_usage.tabs.teamHint")}
          </p>
          <UsageTable
            nameHeader={t("model_usage.group.kinds.Team")}
            rows={teamRows}
            resetKey={scopeKey}
            total={null}
            showRequests
            onOpen={(r) =>
              changeScope({ type: "team", name: r.key, label: r.name })
            }
          />
        </TabsContent>
        <TabsContent value="apiKey" className="mt-0">
          <UsageTable
            nameHeader={t("model_usage.apiKey")}
            rows={keyRows}
            resetKey={scopeKey}
            total={keyRows.reduce((sum, r) => sum + r.total, 0)}
          />
        </TabsContent>
        <TabsContent value="model" className="mt-0">
          <UsageTable
            nameHeader={t("model_usage.model")}
            rows={modelRows}
            resetKey={scopeKey}
            total={totals.total}
            showRequests={!!scope}
          />
        </TabsContent>
        <TabsContent value="detail" className="mt-0">
          {scope ? (
            <DetailTable<GroupUsageRecord>
              rows={detailRows as GroupUsageRecord[]}
              resetKey={scopeKey}
              whoHeader={t("model_usage.group.kinds.User")}
              whoOf={(r) => r.display_name || r.name}
              rowKey={(r) =>
                `${r.date}-${r.name}-${r.endpoint_name}-${r.model_name}`
              }
            />
          ) : (
            <DetailTable<ApiUsageRecord>
              rows={detailRows as ApiUsageRecord[]}
              resetKey={scopeKey}
              whoHeader={t("model_usage.apiKey")}
              whoOf={(r) => (
                <ApiKeyLabel
                  name={r.api_key_name}
                  displayName={r.api_key_display_name}
                  description={r.api_key_description}
                />
              )}
              rowKey={(r) =>
                `${r.date}-${r.api_key_id}-${r.endpoint_name}-${r.model_name}`
              }
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <ListPage
      title={t("model_usage.title")}
      canCreate={false}
      breadcrumb={false}
      extra={
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            for (const q of queries) q.refetch();
          }}
          disabled={loading}
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          {t("model_usage.refresh")}
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 [&>button]:h-8 [&_[role=combobox]]:h-8">
        <DateRangePicker className="h-8" value={range} onChange={changeRange} />
        <Select
          value={model || ALL_MODELS}
          onValueChange={(v) => setModel(v === ALL_MODELS ? "" : v)}
        >
          <SelectTrigger
            className="w-[220px]"
            aria-label={t("model_usage.filters.model")}
            data-testid="usage-model-filter"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_MODELS}>
              {t("model_usage.filters.allModels")}
            </SelectItem>
            {/* The picked model stays listed when the scope has no usage of
                it, so the control still says what it filters by. */}
            {[
              ...models.map((m) => m.key),
              ...(model && !models.some((m) => m.key === model) ? [model] : []),
            ].map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {scope ? (
        <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-4">
            <UsageScopePanel
              roots={roots}
              nodesByName={nodesByName}
              nodesById={nodesById}
              scope={scope}
              canReadPlatform={canReadAllGroups}
              teams={teamList}
              onScopeChange={changeScope}
            />
          </div>
          {content}
        </div>
      ) : (
        content
      )}
    </ListPage>
  );
};
