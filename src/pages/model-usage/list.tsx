import { useParsed } from "@refinedev/core";
import { RefreshCw } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useOrgTree,
  useReadableUsageTeams,
} from "@/domains/organization/hooks/use-organization";
import { isProjectTeam } from "@/domains/organization/lib/team";
import {
  type DateRange,
  DateRangePicker,
  formatRangeLabel,
  trailingRange,
} from "@/foundation/components/DateRangePicker";
import { ListPage } from "@/foundation/components/ListPage";
import { SegmentedControl } from "@/foundation/components/SegmentedControl";
import {
  useHasGlobalPermission,
  useHasPermission,
} from "@/foundation/hooks/use-has-permission";
import { displayName } from "@/foundation/lib/display-name";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { ScopeBreadcrumb } from "@/pages/model-usage/components/ScopeBreadcrumb";
import { UsageChart } from "@/pages/model-usage/components/UsageChart";
import {
  ModelShare,
  UsageSummary,
} from "@/pages/model-usage/components/UsageOverview";
import {
  type OverviewRow,
  UsageScopeOverview,
} from "@/pages/model-usage/components/UsageScopeOverview";
import { UsageScopePanel } from "@/pages/model-usage/components/UsageScopePanel";
import {
  DetailTable,
  UsageTable,
} from "@/pages/model-usage/components/UsageTables";
import {
  APPLICATIONS_KEY,
  type BreakdownLabels,
  breakdownLabelKeys,
  groupOf,
  isOwnerScope,
  scopeTrail,
  UNASSIGNED_KEY,
  type UsageScope,
} from "@/pages/model-usage/lib/usage-scope";
import {
  buildTrend,
  daysIn,
  foldRemainder,
  OTHER_SERIES_KEY,
  OTHER_TEAMS_SERIES_KEY,
  type TrendMetric,
} from "@/pages/model-usage/lib/usage-series";
import {
  readUsageView,
  type UsageTab,
  type UsageView,
  writeUsageView,
} from "@/pages/model-usage/lib/usage-view";
import { useApplicationTeams } from "@/pages/model-usage/lib/use-application-teams";
import { useScopeCollapsed } from "@/pages/model-usage/lib/use-scope-collapsed";
import { useScopeUsage } from "@/pages/model-usage/lib/use-scope-usage";

const RANGE_PRESETS = [7, 30, 90];
// The window the page opens on, and the fallback when nothing else was picked.
const DEFAULT_RANGE_DAYS = 30;
// How many entries get their own line/bar before the rest folds into "other".
// It bounds the tooltip row count: at 8 the tooltip is ~200px inside the 240px
// chart card, and every extra series pushes it closer to spilling out.
const TOP_K = 8;
const TEAM_TOP_K = 5;
// The model filter's "every model" value.
const ALL_MODELS = "__all__";
const PLATFORM: UsageScope = { type: "platform" };

/**
 * The page's view, kept in the URL. A new scope is a new history entry; the
 * range, model and tab replace the current one.
 */
const useUsageView = () => {
  const [params, setParams] = useSearchParams();
  const read = useMemo(() => readUsageView(params), [params]);
  // The scope keeps its identity while the URL names the same one, so a tab,
  // model or range change does not rebuild what is computed per scope.
  const lastScope = useRef(read.scope);
  if (JSON.stringify(lastScope.current) !== JSON.stringify(read.scope)) {
    lastScope.current = read.scope;
  }
  const view = { ...read, scope: lastScope.current };
  const update = useCallback(
    (change: Partial<UsageView>) =>
      setParams((previous) => writeUsageView(previous, change), {
        replace: !("scope" in change),
      }),
    [setParams],
  );
  return [view, update] as const;
};

export const ModelUsageList = () => {
  const { t, i18n } = useTranslation();
  const { params } = useParsed();
  const workspace = (params?.workspace as string) ?? "";

  const [scopeCollapsed, toggleScopeCollapsed] = useScopeCollapsed();
  const [view, updateView] = useUsageView();
  const range = useMemo(
    () => view.range ?? trailingRange(DEFAULT_RANGE_DAYS),
    [view.range],
  );
  const setRange = useCallback(
    (next: DateRange) => updateView({ range: next }),
    [updateView],
  );
  const model = view.model;
  const setModel = useCallback(
    (next: string) => updateView({ model: next }),
    [updateView],
  );
  // The breakdown's entries never overlap, so a stacked bar shows the scope's
  // daily total and who made it up at once.
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [pickedMetric, setMetric] = useState<TrendMetric>("tokens");
  // Series toggled off via the (clickable) chart legend.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  // The range to come back to after drilling into a day, so the way back is
  // whatever the reader was looking at — a preset or their own custom window.
  const [lastRange, setLastRange] = useState<DateRange | null>(null);
  const pickedTab = view.tab;
  const setTab = useCallback(
    (next: UsageTab) => updateView({ tab: next }),
    [updateView],
  );

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
    isLoading: orgLoading,
  } = useOrgTree(canReadGroups);
  // The Teams the caller may open as a scope: the RPC refuses usage by Team
  // to everyone else.
  const {
    list: teamList,
    byName: teamsByName,
    isLoading: teamsLoading,
  } = useReadableUsageTeams();
  const hasScopes = canReadGroups || teamList.length > 0;

  // The page opens on the whole platform, on the first department of a
  // department admin, or on the first Team of a Team reader; null is the
  // usage of every API key the caller reads. Undefined until a scope is
  // picked.
  const pickedScope = view.scope;
  const firstRoot = roots[0]?.unit.metadata.name;
  // As the panel lists them: Teams before scenarios.
  const firstTeam =
    teamList.find((team) => !isProjectTeam(team)) ?? teamList[0];
  // Memoized: the scope keys the page's heavier memos.
  const defaultScope = useMemo<UsageScope | null>(
    () =>
      canReadAllGroups
        ? PLATFORM
        : firstRoot
          ? { type: "orgUnit", name: firstRoot }
          : firstTeam
            ? {
                type: "team",
                name: firstTeam.metadata.name,
                label: displayName(firstTeam.metadata),
              }
            : null,
    [canReadAllGroups, firstRoot, firstTeam],
  );
  const picked = pickedScope === undefined ? defaultScope : pickedScope;
  // A Team named in the URL takes its label from the Teams the caller reads.
  const scope = useMemo<UsageScope | null>(() => {
    if (!picked) return null;
    const allowed =
      picked.type === "platform" ||
      picked.type === "applications" ||
      (picked.type === "application" && !picked.from)
        ? canReadAllGroups
        : canReadGroups || groupOf(picked)?.type === "team";
    if (!allowed) return null;
    const labeled = <S extends UsageScope | null>(s: S): S => {
      const team = s?.type === "team" ? teamsByName.get(s.name) : undefined;
      return team ? { ...s, label: displayName(team.metadata) } : s;
    };
    return isOwnerScope(picked)
      ? { ...picked, from: labeled(picked.from) }
      : labeled(picked);
  }, [picked, canReadAllGroups, canReadGroups, teamsByName]);
  const changeScope = useCallback(
    (next: UsageScope | null) => {
      updateView({ scope: next });
      setHidden(new Set());
    },
    [updateView],
  );

  // The tabs this scope has. Every group scope counts API keys, and so does a
  // user or an application, by the keys they own; Teams need a global
  // reader. The models are the card beside the chart.
  const tabs = useMemo<UsageTab[]>(() => {
    if (!scope) return ["apiKey", "detail"];
    if (isOwnerScope(scope)) return ["apiKey", "detail"];
    if (scope.type === "applications") return ["breakdown", "detail"];
    if (scope.type === "team") return ["breakdown", "apiKey", "detail"];
    return [
      ...(scope.type === "platform" ? (["overview"] as const) : []),
      "breakdown",
      ...(canReadAllGroups ? (["team"] as const) : []),
      "apiKey",
      "detail",
    ];
  }, [scope, canReadAllGroups]);
  const tab = pickedTab && tabs.includes(pickedTab) ? pickedTab : tabs[0];
  // The daily detail lists the scope's users and applications, or, where the
  // scope has an API keys tab, its keys. A key reader's detail is by key.
  const [pickedDetailBy, setDetailBy] = useState<"subject" | "key">("subject");
  const canDetailByKey = !!scope && tabs.includes("apiKey");
  const detailByKey =
    canDetailByKey && pickedDetailBy === "key" && tab === "detail";
  // Usage by API key carries no request count.
  const metric: TrendMetric = scope ? pickedMetric : "tokens";
  const deletedKeyLabel = useCallback(
    (id: string) => t("model_usage.deletedKey", { id }),
    [t],
  );
  const breakdownLabels = useMemo<BreakdownLabels>(
    () => ({
      unassigned: t("model_usage.scope.unassigned"),
      applications: t("model_usage.scope.applicationsNoDepartment"),
      application: t("model_usage.group.kinds.ServiceAccount"),
    }),
    [t],
  );

  // Only a global reader reads the platform's Team usage.
  const showTeamChart = scope?.type === "platform" && canReadAllGroups;

  const applicationTeams = useApplicationTeams(hasScopes);

  const {
    models,
    scopeTotal,
    facts,
    totals,
    previousTotal,
    activity,
    breakdown,
    breakdownSeries,
    keyFacts,
    keyRows,
    teamFacts,
    teamRows,
    teamsLoading: teamRowsLoading,
    loading,
    error,
    refetch,
  } = useScopeUsage({
    workspace,
    range,
    model,
    scope,
    teamsOpen: tab === "team" || tab === "overview" || showTeamChart,
    keysOpen: tab === "apiKey" || detailByKey,
    roots,
    nodesByName,
    teamsByName,
    breakdownLabels,
    applicationTeams,
    deletedKeyLabel,
  });

  // Picking a day in the chart narrows the range itself to that day — there is
  // no second "focused day" state, so every panel on the page follows the same
  // scope and the date control is both the state and the way back.
  const isSingleDay = range.start === range.end;

  const changeRange = useCallback(
    (next: DateRange) => {
      setRange(next);
      // Remember where to come back to. A single day picked in the calendar is
      // itself a drill-down, so it is not a place to come back to.
      if (next.start !== next.end) setLastRange(next);
    },
    [setRange],
  );

  const pickDay = useCallback(
    (day: string) => {
      setLastRange((previous) =>
        range.start === range.end ? previous : range,
      );
      setRange({ start: day, end: day });
    },
    [range, setRange],
  );

  const resetRange = useCallback(
    () => setRange(lastRange ?? trailingRange(DEFAULT_RANGE_DAYS)),
    [lastRange, setRange],
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
          range: formatRangeLabel(target, i18n?.language),
        });
  }, [lastRange, t, i18n?.language]);

  // The chart splits the scope like the first tab: departments and users,
  // a user's models, or a key reader's API keys.
  const days = useMemo(() => daysIn(range), [range]);
  // At the platform, the line view adds the Teams and scenarios to the
  // departments. They overlap, so the stacked bars keep to departments.
  const mixedLines = showTeamChart && chartType === "line" && !isSingleDay;
  const chart = useMemo(() => {
    if (!scope) {
      const series = foldRemainder(keyRows, TOP_K, (n) =>
        t("model_usage.daily.otherKeys", { n }),
      );
      return {
        series,
        trend: buildTrend(keyFacts, series, (r) => r.who.key, "tokens", days),
      };
    }
    // Members without usage have nothing to draw.
    const base = breakdownSeries
      .filter((s) => s.total > 0)
      .map((s) =>
        mixedLines && s.key !== UNASSIGNED_KEY && s.key !== APPLICATIONS_KEY
          ? {
              ...s,
              name: `${s.name}${t("model_usage.trend.departmentSuffix")}`,
            }
          : s,
      );
    const series = foldRemainder(base, TOP_K, (n) =>
      t("model_usage.daily.otherGroups", { n }),
    );
    const trend = buildTrend(breakdown, series, (r) => r.entry, metric, days);
    if (!mixedLines) return { series, trend };

    const teamSeries = foldRemainder(
      teamRows
        .filter((row) => row.total > 0)
        .map((row) => {
          const team = teamsByName.get(row.key);
          const suffix =
            team && isProjectTeam(team)
              ? t("model_usage.trend.scenarioSuffix")
              : t("model_usage.trend.teamSuffix");
          return {
            ...row,
            key: `team:${row.key}`,
            name: `${row.name}${suffix}`,
          };
        }),
      TEAM_TOP_K,
      (n) => t("model_usage.trend.otherTeams", { n }),
    ).map((s) =>
      s.key === OTHER_SERIES_KEY ? { ...s, key: OTHER_TEAMS_SERIES_KEY } : s,
    );
    const teamTrend = buildTrend(
      teamFacts,
      teamSeries.map((s) =>
        s.key === OTHER_TEAMS_SERIES_KEY ? { ...s, key: OTHER_SERIES_KEY } : s,
      ),
      (r) => `team:${r.who.key}`,
      metric,
      days,
    );
    // Both trends cover the same days, so the points line up by index.
    return {
      series: [...series, ...teamSeries],
      trend: trend.map((point, i) => {
        const {
          date: _date,
          [OTHER_SERIES_KEY]: other,
          ...rest
        } = teamTrend[i];
        return {
          ...point,
          ...rest,
          ...(other === undefined ? {} : { [OTHER_TEAMS_SERIES_KEY]: other }),
        };
      }),
    };
  }, [
    scope,
    mixedLines,
    breakdownSeries,
    breakdown,
    keyRows,
    keyFacts,
    teamRows,
    teamFacts,
    teamsByName,
    metric,
    days,
    t,
  ]);
  const labelKeys = breakdownLabelKeys(scope);
  const mixedTitle = t(
    metric === "requests"
      ? "model_usage.trend.titleRequestsMixed"
      : "model_usage.trend.titleMixed",
  );
  const barHint = showTeamChart && chartType === "bar" && !isSingleDay;

  const keyTotal = keyRows.reduce((sum, r) => sum + r.total, 0);
  // Usage recorded before per-key attribution, or by keys deleted since, is in
  // the total but in no key's row.
  const keyCoverageShort = !!scope && !loading && keyTotal < totals.total;

  const detailRows = useMemo(
    () =>
      [...(detailByKey ? keyFacts : facts)].sort(
        (a, b) =>
          b.date.localeCompare(a.date) || (b.usage ?? 0) - (a.usage ?? 0),
      ),
    [detailByKey, keyFacts, facts],
  );

  const trail = useMemo(
    () =>
      scopeTrail(scope, {
        canReadAllGroups,
        nodesByName,
        nodesById,
        platformLabel: t("model_usage.scope.platform"),
        applicationsLabel: t("model_usage.scope.applications"),
      }),
    [scope, canReadAllGroups, nodesByName, nodesById, t],
  );

  // What the page is counting, named in the heading: the breadcrumb leads
  // away from the scope, so it cannot be the only place that says which it is.
  const heading = useMemo(() => {
    const title = t("model_usage.title");
    if (!scope || scope.type === "platform") return title;
    const named = (kind: string, name: string) =>
      t(`model_usage.heading.${kind}`, { title, name });
    switch (scope.type) {
      case "applications":
        return named("applications", breakdownLabels.applications);
      case "orgUnit":
        return named(
          "department",
          nodesByName.get(scope.name)?.label ?? scope.name,
        );
      case "team": {
        const team = teamsByName.get(scope.name);
        return named(
          team && isProjectTeam(team) ? "scenario" : "team",
          scope.label,
        );
      }
      case "user":
        return named("user", scope.label);
      case "application":
        return named("application", scope.label);
    }
  }, [scope, nodesByName, teamsByName, breakdownLabels, t]);

  // The platform's Teams and scenarios, split by the Team's scenario flag.
  const overview = useMemo(() => {
    const teams: OverviewRow[] = [];
    const scenarios: OverviewRow[] = [];
    for (const row of teamRows) {
      const team = teamsByName.get(row.key);
      (team && isProjectTeam(team) ? scenarios : teams).push({
        ...row,
        target: row.target ?? null,
      });
    }
    return { teams, scenarios };
  }, [teamRows, teamsByName]);

  // Whether the platform has none at all, as opposed to none with usage.
  const noTeams =
    !teamsLoading &&
    ![...teamsByName.values()].some((team) => !isProjectTeam(team));
  const noScenarios =
    !teamsLoading && ![...teamsByName.values()].some(isProjectTeam);

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

  const tabLabel: Record<UsageTab, string> = {
    overview: t("model_usage.tabs.overview"),
    breakdown: labelKeys.tab ? t(labelKeys.tab) : "",
    team: t("model_usage.tabs.teams"),
    apiKey: t("model_usage.tabs.apiKeys"),
    detail: t("model_usage.tabs.detail"),
  };

  const content = (
    <div className="min-w-0 space-y-4">
      <ScopeBreadcrumb trail={trail} onScopeChange={changeScope} />

      <UsageSummary
        totals={totals}
        previousTotal={previousTotal}
        activity={activity}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <UsageChart
          series={chart.series}
          trendData={chart.trend}
          dayCategories={isSingleDay ? chart.series : []}
          isSingleDay={isSingleDay}
          seriesLabel={t(labelKeys.series)}
          chartType={chartType}
          onChartTypeChange={setChartType}
          title={mixedLines ? mixedTitle : undefined}
          hint={barHint ? t("model_usage.trend.barHint") : undefined}
          metric={metric}
          onMetricChange={scope ? setMetric : undefined}
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

      <Card className="overflow-hidden">
        <Tabs value={tab} onValueChange={(v) => setTab(v as UsageTab)}>
          <div className="border-b border-[var(--nt-stroke-neutral-trans-2)] px-3 py-2">
            <TabsList>
              {tabs.map((value) => (
                <TabsTrigger key={value} value={value}>
                  {tabLabel[value]}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="overview" className="mt-0">
            <UsageScopeOverview
              departments={breakdownSeries}
              teams={overview.teams}
              scenarios={overview.scenarios}
              total={totals.total}
              teamsLoading={teamRowsLoading}
              noTeams={noTeams}
              noScenarios={noScenarios}
              onOpen={changeScope}
              onViewDepartments={() => setTab("breakdown")}
              onViewTeams={() => setTab("team")}
            />
          </TabsContent>
          <TabsContent value="breakdown" className="mt-0">
            <UsageTable
              nameHeader={labelKeys.column ? t(labelKeys.column) : ""}
              rows={breakdownSeries}
              resetKey={scopeKey}
              total={totals.total}
              showRequests
              onOpen={changeScope}
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
              onOpen={changeScope}
            />
          </TabsContent>
          <TabsContent value="apiKey" className="mt-0">
            {keyCoverageShort ? (
              <p
                className="px-4 pt-3 text-xs text-muted-foreground"
                data-testid="usage-key-coverage-hint"
              >
                {t("model_usage.tabs.apiKeyCoverageHint")}
              </p>
            ) : null}
            <UsageTable
              nameHeader={t("model_usage.apiKey")}
              rows={keyRows}
              resetKey={scopeKey}
              total={keyTotal}
            />
          </TabsContent>
          <TabsContent value="detail" className="mt-0">
            {canDetailByKey ? (
              <div className="px-4 pt-3">
                <SegmentedControl<"subject" | "key">
                  ariaLabel={t("model_usage.detail.groupBy")}
                  value={pickedDetailBy}
                  onValueChange={setDetailBy}
                  items={[
                    {
                      value: "subject",
                      label: t("model_usage.detail.bySubject", {
                        who: t(labelKeys.who),
                      }),
                    },
                    { value: "key", label: t("model_usage.detail.byKey") },
                  ]}
                />
              </div>
            ) : null}
            <DetailTable
              rows={detailRows}
              resetKey={`${scopeKey}|${detailByKey}`}
              whoHeader={
                detailByKey ? t("model_usage.apiKey") : t(labelKeys.who)
              }
            />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );

  return (
    <ListPage
      title={heading}
      canCreate={false}
      breadcrumb={false}
      extra={
        <Button
          variant="outline"
          size="sm"
          onClick={refetch}
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

      {hasScopes ? (
        <div
          className={cn(
            "grid items-start gap-4",
            scopeCollapsed
              ? "lg:grid-cols-[44px_minmax(0,1fr)]"
              : "lg:grid-cols-[240px_minmax(0,1fr)]",
          )}
        >
          <div className="lg:sticky lg:top-4">
            <UsageScopePanel
              roots={roots}
              nodesByName={nodesByName}
              nodesById={nodesById}
              scope={scope}
              canReadPlatform={canReadAllGroups}
              loading={orgLoading || teamsLoading}
              collapsed={scopeCollapsed}
              onToggleCollapsed={toggleScopeCollapsed}
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
