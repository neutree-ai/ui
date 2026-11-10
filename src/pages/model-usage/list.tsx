import { useParsed } from "@refinedev/core";
import { RefreshCw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
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
  useTeamsByName,
} from "@/domains/organization/hooks/use-organization";
import {
  type DateRange,
  DateRangePicker,
  formatRangeLabel,
  trailingRange,
} from "@/foundation/components/DateRangePicker";
import { ListPage } from "@/foundation/components/ListPage";
import {
  useHasGlobalPermission,
  useHasPermission,
  useTeamsWithPermission,
} from "@/foundation/hooks/use-has-permission";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { ScopeBreadcrumb } from "@/pages/model-usage/components/ScopeBreadcrumb";
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
  breakdownLabelKeys,
  groupOf,
  scopeTrail,
  type UsageScope,
} from "@/pages/model-usage/lib/usage-scope";
import {
  buildTrend,
  foldRemainder,
  type UsageSeries,
} from "@/pages/model-usage/lib/usage-series";
import { useScopeUsage } from "@/pages/model-usage/lib/use-scope-usage";

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
  // A Team is a scope for a global reader, and for whoever reads that Team's
  // usage: the RPC refuses usage by Team to everyone else.
  const canReadSomeTeam = useHasPermission("team_usage:read").allowed === true;
  const { list: allTeams, byName: teamsByName } = useTeamsByName(
    canReadAllGroups || canReadSomeTeam,
  );
  const readableTeamIds = useTeamsWithPermission(
    "team_usage:read",
    useMemo(() => allTeams.map((team) => team.id), [allTeams]),
    !canReadAllGroups && canReadSomeTeam,
  );
  const teamList = useMemo(
    () =>
      canReadAllGroups
        ? allTeams
        : allTeams.filter((team) => readableTeamIds.has(team.id)),
    [canReadAllGroups, allTeams, readableTeamIds],
  );
  const hasScopes = canReadGroups || teamList.length > 0;

  // The page opens on the whole platform, or on the first department of a
  // department admin; null is the usage of every API key the caller reads.
  // Undefined until a scope is picked.
  const [pickedScope, setPickedScope] = useState<UsageScope | null>();
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
  const picked = pickedScope === undefined ? defaultScope : pickedScope;
  const scope =
    picked && (canReadGroups || groupOf(picked)?.type === "team")
      ? picked
      : null;
  const changeScope = useCallback((next: UsageScope | null) => {
    setPickedScope(next);
    setHidden(new Set());
  }, []);

  // The tabs this scope has. API keys are counted for the platform (global
  // readers), a department and a Team; Teams need a global reader.
  const tabs = useMemo<Tab[]>(() => {
    if (!scope) return ["apiKey", "model", "detail"];
    if (scope.type === "user") return ["model", "detail"];
    if (scope.type === "team")
      return ["breakdown", "apiKey", "model", "detail"];
    return [
      "breakdown",
      ...(canReadAllGroups ? (["team"] as const) : []),
      ...(scope.type === "orgUnit" || canReadAllGroups
        ? (["apiKey"] as const)
        : []),
      "model",
      "detail",
    ];
  }, [scope, canReadAllGroups]);
  const tab = tabs.includes(pickedTab) ? pickedTab : tabs[0];
  const deletedKeyLabel = useCallback(
    (id: string) => t("model_usage.deletedKey", { id }),
    [t],
  );

  const {
    models,
    scopeTotal,
    facts,
    totals,
    breakdown,
    breakdownSeries,
    keyFacts,
    keyRows,
    teamRows,
    loading,
    error,
    refetch,
  } = useScopeUsage({
    workspace,
    range,
    model,
    scope,
    teamsOpen: tab === "team",
    keysOpen: tab === "apiKey",
    roots,
    nodesByName,
    teamsByName,
    unassignedLabel: t("model_usage.scope.unassigned"),
    deletedKeyLabel,
  });

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

  // The chart splits the scope like the first tab: departments and users,
  // a user's models, or a key reader's API keys.
  const chart = useMemo(() => {
    const [base, otherKey, trendOf] = scope
      ? ([
          // Members without usage have nothing to draw.
          breakdownSeries.filter((s) => s.total > 0),
          "model_usage.daily.otherGroups",
          (series: UsageSeries[]) =>
            buildTrend(breakdown, series, (r) => r.entry),
        ] as const)
      : ([
          keyRows,
          "model_usage.daily.otherKeys",
          (series: UsageSeries[]) =>
            buildTrend(keyFacts, series, (r) => r.who.key),
        ] as const);
    const series = foldRemainder(base, TOP_K, (n) => t(otherKey, { n }));
    return { series, trend: trendOf(series) };
  }, [scope, breakdownSeries, breakdown, keyRows, keyFacts, t]);
  const labelKeys = breakdownLabelKeys(scope);

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

  const trail = useMemo(
    () =>
      scopeTrail(scope, {
        canReadAllGroups,
        nodesByName,
        nodesById,
        platformLabel: t("model_usage.scope.platform"),
      }),
    [scope, canReadAllGroups, nodesByName, nodesById, t],
  );

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

  const tabLabel: Record<Tab, string> = {
    breakdown: labelKeys.tab ? t(labelKeys.tab) : "",
    team: t("model_usage.tabs.teams"),
    apiKey: t("model_usage.tabs.apiKeys"),
    model: t("model_usage.tabs.models"),
    detail: t("model_usage.tabs.detail"),
  };

  const content = (
    <div className="min-w-0 space-y-4">
      <ScopeBreadcrumb trail={trail} onScopeChange={changeScope} />

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

      <Card className="overflow-hidden">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
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
            <DetailTable
              rows={detailRows}
              resetKey={scopeKey}
              whoHeader={t(
                scope ? "model_usage.group.kinds.User" : "model_usage.apiKey",
              )}
            />
          </TabsContent>
        </Tabs>
      </Card>
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
