import { useParsed } from "@refinedev/core";
import { RefreshCw } from "lucide-react";
import { type ReactNode, useCallback, useId, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiKeyLabel } from "@/domains/api-key/components/ApiKeyLabel";
import { useGroupUsage } from "@/domains/api-key/hooks/use-group-usage";
import { useWorkspaceUsage } from "@/domains/api-key/hooks/use-workspace-usage";
import type {
  ApiUsageRecord,
  GroupUsageKind,
  GroupUsageRecord,
} from "@/domains/api-key/types";
import {
  useOrgTree,
  useTeamsByName,
} from "@/domains/organization/hooks/use-organization";
import type { OrgTreeNode } from "@/domains/organization/lib/org-tree";
import {
  type DateRange,
  DateRangePicker,
  formatRangeLabel,
  trailingRange,
} from "@/foundation/components/DateRangePicker";
import { EMPTY_VALUE, EmptyValue } from "@/foundation/components/EmptyValue";
import { ListPage } from "@/foundation/components/ListPage";
import { PaginationControls } from "@/foundation/components/PaginationControls";
import {
  useHasGlobalPermission,
  useHasPermission,
} from "@/foundation/hooks/use-has-permission";
import { displayName } from "@/foundation/lib/display-name";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatTokens } from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";
import {
  formatTick,
  UsageChart,
} from "@/pages/model-usage/components/UsageChart";
import {
  aggregateSeries,
  buildTrend,
  foldRemainder,
  orderSeries,
  type UsageSeries,
} from "@/pages/model-usage/lib/usage-series";

const RANGE_PRESETS = [7, 30, 90];
// The window the page opens on, and the fallback when nothing else was picked.
const DEFAULT_RANGE_DAYS = 30;
// How many API keys get their own line/bar before the rest folds into "other".
// It bounds the tooltip row count: at 8 the tooltip is ~200px inside the 240px
// chart card, and every extra series pushes it closer to spilling out.
const TOP_K = 8;
// Rows per page in the tables under the chart. A busy workspace has 50+ keys on
// a single day, which made the page thousands of pixels tall.
// The two breakdown cards are a glanceable ranking, so they page at 10; the
// per-record table is where people hunt for a specific request, so it shows 50.
const CARD_PAGE_SIZE = 10;
const DETAIL_PAGE_SIZE = 50;
const GROUP_KINDS: GroupUsageKind[] = ["User", "Team", "OrgUnit"];
// org_unit:usage-read alone reads users and departments of the caller's
// subtree; Team totals stay with a global workspace:usage-read.
const SUBTREE_GROUP_KINDS: GroupUsageKind[] = ["User", "OrgUnit"];
// The "no filter" value of the department and team selects by user.
const ALL_GROUPS = "__all__";
// What the chart's series are: API keys, or users / groups of one kind.
type ChartDimension = "ApiKey" | GroupUsageKind;

export const ModelUsageList = () => {
  const { t } = useTranslation();
  const { params } = useParsed();
  const workspace = (params?.workspace as string) ?? "";

  const [range, setRange] = useState<DateRange>(() =>
    trailingRange(DEFAULT_RANGE_DAYS),
  );
  const [apiKeyId, setApiKeyId] = useState<string>("");
  const [endpointType, setEndpointType] = useState<string>("");
  const [model, setModel] = useState("");
  // Chart display mode — line (trend per series) or stacked bar (daily volume).
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  // Series toggled off via the (clickable) chart legend.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  // The range to come back to after drilling into a day, so the way back is
  // whatever the reader was looking at — a preset or their own custom window.
  const [lastRange, setLastRange] = useState<DateRange | null>(null);

  const { usageData, isLoading, error, refetch } = useWorkspaceUsage(
    workspace,
    range.start,
    range.end,
  );

  // Group totals include other users' usage: a global workspace:usage-read
  // reads every group, org_unit:usage-read the users and departments of the
  // caller's subtree. Nobody else gets the card or the call.
  const canReadAllGroups =
    useHasGlobalPermission("workspace:usage-read").allowed === true;
  const canReadSubtree =
    useHasPermission("org_unit:usage-read").allowed === true;
  const canReadGroups = canReadAllGroups || canReadSubtree;
  const groupKinds = canReadAllGroups ? GROUP_KINDS : SUBTREE_GROUP_KINDS;
  const [pickedGroupKind, setGroupKind] = useState<GroupUsageKind>("User");
  const groupKind = groupKinds.includes(pickedGroupKind)
    ? pickedGroupKind
    : "User";
  // The group card's kind drives the chart too, so both show the same
  // breakdown; picking an API key goes back to the per-key chart.
  const [chartDimension, setChartDimension] =
    useState<ChartDimension>("ApiKey");
  const chartGroupKind =
    canReadGroups && chartDimension !== "ApiKey" ? groupKind : null;
  const pickGroupKind = (kind: GroupUsageKind) => {
    setGroupKind(kind);
    setChartDimension(kind);
    // Groups overlap (a department holds its sub-departments, a user may be
    // in several teams), so a stacked bar would overstate the total.
    setChartType("line");
  };
  // By user, the rows can be narrowed to one department (with its
  // sub-departments) or, for a global reader, one team. The server only
  // narrows: a department admin still reads only the units they manage.
  const [unitFilter, setUnitFilter] = useState(ALL_GROUPS);
  const [teamFilter, setTeamFilter] = useState(ALL_GROUPS);
  const byUser = groupKind === "User";
  const groupFilter = useMemo(
    () =>
      byUser
        ? {
            orgUnit: unitFilter === ALL_GROUPS ? undefined : unitFilter,
            team:
              canReadAllGroups && teamFilter !== ALL_GROUPS
                ? teamFilter
                : undefined,
          }
        : {},
    [byUser, unitFilter, teamFilter, canReadAllGroups],
  );
  const groupUsage = useGroupUsage(
    canReadGroups ? workspace : undefined,
    range.start,
    range.end,
    groupKind,
    groupFilter,
  );
  // Departments are listed in tree order with their path. Without
  // org_unit:read the list is empty and the rows keep the usage order.
  const { byId: orgUnitsById } = useOrgTree(
    canReadGroups && (groupKind === "OrgUnit" || byUser),
  );
  const { list: teams } = useTeamsByName(canReadAllGroups && byUser);
  const teamOptions = useMemo(
    () =>
      teams
        .map((team) => ({
          name: team.metadata.name,
          label: displayName(team.metadata),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [teams],
  );
  const orgNodes = useMemo(
    () =>
      new Map<string, { position: number; node: OrgTreeNode }>(
        [...orgUnitsById.values()].map((node, position) => [
          node.unit.metadata.name,
          { position, node },
        ]),
      ),
    [orgUnitsById],
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

  // Filter dropdown options are derived entirely from the usage RPC rows. The
  // RPC (SECURITY DEFINER) already returns the id + name of every key visible to
  // the caller — their own keys, plus other members' keys when they hold
  // workspace:usage-read — so a permitted user can filter by those keys without
  // a separate api_keys query and without widening api_keys row visibility (we
  // only reuse the id/name the RPC already returned). Keys with no usage in the
  // selected window are intentionally absent: picking one would only ever yield
  // an empty view. Derived from usageData (not the key-filtered rows) so picking
  // a key never prunes the dropdown; sorted by name for a stable order.
  const keyOptions = useMemo(() => {
    const byId = new Map<
      string,
      { name: string; description: string | null }
    >();
    for (const r of usageData) {
      if (r.api_key_id && !byId.has(r.api_key_id)) {
        byId.set(r.api_key_id, {
          name: r.api_key_display_name || r.api_key_name || r.api_key_id,
          description: r.api_key_description || null,
        });
      }
    }
    return [...byId.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [usageData]);

  // What the closed control shows: the key's name, one line. The description
  // stays in the list, where there is room for it.
  const selectedKey = keyOptions.find((k) => k.id === apiKeyId);

  const filtered = useMemo(
    () =>
      usageData.filter(
        (r) =>
          (!apiKeyId || r.api_key_id === apiKeyId) &&
          (!endpointType || r.endpoint_type === endpointType) &&
          (!model ||
            (r.model_name ?? "")
              .toLowerCase()
              .includes(model.trim().toLowerCase())),
      ),
    [usageData, apiKeyId, endpointType, model],
  );

  // With "All API keys" each series is an API key; once a key is picked we drill
  // into that key's per-model usage instead.
  const groupByModel = Boolean(apiKeyId);
  const seriesKey = useCallback(
    (r: ApiUsageRecord) =>
      groupByModel ? (r.model_name ?? EMPTY_VALUE) : r.api_key_id,
    [groupByModel],
  );
  const seriesMeta = useCallback(
    (r: ApiUsageRecord) =>
      groupByModel
        ? { name: r.model_name ?? EMPTY_VALUE, description: null }
        : {
            name: r.api_key_display_name || r.api_key_name,
            description: r.api_key_description || null,
          },
    [groupByModel],
  );

  // The group RPC has no API key column, so only the type and model filters
  // apply to it.
  const groupRows = useMemo(
    () =>
      groupUsage.usageData.filter(
        (r: GroupUsageRecord) =>
          (!endpointType || r.endpoint_type === endpointType) &&
          (!model ||
            (r.model_name ?? "")
              .toLowerCase()
              .includes(model.trim().toLowerCase())),
      ),
    [groupUsage.usageData, endpointType, model],
  );
  const groupMeta = useCallback(
    (r: GroupUsageRecord) => {
      if (r.kind === "OrgUnit") {
        const node = orgNodes.get(r.name)?.node;
        return {
          name: r.display_name || node?.label || r.name,
          description:
            node && node.pathLabel !== node.label ? node.pathLabel : null,
        };
      }
      // A synced Team's name is an internal hash (org-ldap-…), so it is not
      // shown, as for departments.
      return { name: r.display_name || r.name, description: null };
    },
    [orgNodes],
  );

  // Multi-day: the top TOP_K series each get a line, the rest fold into one
  // "other" series. A single key's models are few enough to show in full.
  const series = useMemo(() => {
    if (chartGroupKind) {
      return foldRemainder(
        aggregateSeries(groupRows, (r) => r.name, groupMeta),
        TOP_K,
        (count) => t("model_usage.daily.otherGroups", { n: count }),
      );
    }
    return foldRemainder(
      aggregateSeries(filtered, seriesKey, seriesMeta),
      groupByModel ? Number.POSITIVE_INFINITY : TOP_K,
      (count) => t("model_usage.daily.otherKeys", { n: count }),
    );
  }, [
    chartGroupKind,
    groupRows,
    groupMeta,
    filtered,
    groupByModel,
    seriesKey,
    seriesMeta,
    t,
  ]);
  const trendData = useMemo(
    () =>
      chartGroupKind
        ? buildTrend(groupRows, series, (r) => r.name)
        : buildTrend(filtered, series, seriesKey),
    [chartGroupKind, groupRows, filtered, series, seriesKey],
  );
  // Single day: same folding, but the chart shows one bar per series with its
  // prompt/completion split.
  const dayCategories = isSingleDay ? series : [];

  const byKey = useMemo(
    () =>
      aggregateSeries(
        filtered,
        (r) => r.api_key_id,
        (r) => ({
          name: r.api_key_display_name || r.api_key_name,
          description: r.api_key_description || null,
        }),
      ),
    [filtered],
  );
  const byModel = useMemo(
    () =>
      aggregateSeries(
        filtered,
        (r) => r.model_name ?? EMPTY_VALUE,
        (r) => ({ name: r.model_name ?? EMPTY_VALUE, description: null }),
      ),
    [filtered],
  );

  const byGroup = useMemo(() => {
    const series = aggregateSeries(groupRows, (r) => r.name, groupMeta);
    return groupKind === "OrgUnit"
      ? orderSeries(series, (key) => orgNodes.get(key)?.position)
      : series;
  }, [groupRows, groupMeta, groupKind, orgNodes]);

  const detailRows = useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          b.date.localeCompare(a.date) || (b.usage ?? 0) - (a.usage ?? 0),
      ),
    [filtered],
  );

  const totalTokens = filtered.reduce((sum, r) => sum + (r.usage ?? 0), 0);
  // A user's usage counts once; Teams and departments overlap, so their sum
  // is no total and the chart leaves it out.
  const chartTotal = !chartGroupKind
    ? totalTokens
    : chartGroupKind === "User"
      ? groupRows.reduce((sum, r) => sum + (r.usage ?? 0), 0)
      : null;
  // The tables reset to page 1 when the scope changes — and only then. The
  // usage RPC polls every minute and hands back new arrays, which must not
  // throw the reader back to page 1.
  const scopeKey = [range.start, range.end, apiKeyId, endpointType, model].join(
    "|",
  );
  const groupScopeKey = [
    scopeKey,
    groupKind,
    groupFilter.orgUnit,
    groupFilter.team,
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

  // A day-scoped table says which day it is, so it never reads as the range view.
  const scopeTitle = (base: string, withDay: string) =>
    isSingleDay ? withDay : base;

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
            refetch();
            if (canReadGroups) groupUsage.refetch();
          }}
          disabled={isLoading}
        >
          <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
          {t("model_usage.refresh")}
        </Button>
      }
    >
      <UsageChart
        series={series}
        trendData={trendData}
        dayCategories={dayCategories}
        isSingleDay={isSingleDay}
        groupByModel={groupByModel}
        groupKindLabel={
          chartGroupKind
            ? t(`model_usage.group.kinds.${chartGroupKind}`)
            : undefined
        }
        headerExtra={
          canReadGroups ? (
            <>
              <Select
                value={chartGroupKind ?? "ApiKey"}
                onValueChange={(v) =>
                  v === "ApiKey"
                    ? setChartDimension("ApiKey")
                    : pickGroupKind(v as GroupUsageKind)
                }
              >
                <SelectTrigger
                  className="h-7 w-[140px]"
                  aria-label={t("model_usage.daily.dimension")}
                  data-testid="usage-chart-dimension"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ApiKey">
                    {groupByModel
                      ? t("model_usage.model")
                      : t("model_usage.apiKey")}
                  </SelectItem>
                  {groupKinds.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {t(`model_usage.group.kinds.${kind}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {chartGroupKind && apiKeyId ? (
                <span className="text-xs font-normal text-muted-foreground">
                  {t("model_usage.group.apiKeyIgnored")}
                </span>
              ) : null}
            </>
          ) : undefined
        }
        chartType={chartType}
        onChartTypeChange={setChartType}
        hidden={hidden}
        onToggleSeries={onToggleSeries}
        totalTokens={chartTotal}
        isLoading={chartGroupKind ? groupUsage.isLoading : isLoading}
        backLabel={backLabel}
        onPickDay={pickDay}
        onResetRange={resetRange}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 [&>button]:h-8 [&_input]:h-8 [&_[role=combobox]]:h-8">
        <DateRangePicker className="h-8" value={range} onChange={changeRange} />
        <Select
          value={apiKeyId || "all"}
          onValueChange={(v) => {
            const next = v === "all" ? "" : v;
            setApiKeyId(next);
            setChartDimension("ApiKey");
            // A single key reads best as a stacked bar of its daily model mix;
            // "All keys" reads best as per-key trend lines.
            setChartType(next ? "bar" : "line");
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("model_usage.filters.apiKey")}>
              {/* The control always has a value — "all" is the no-filter
                  entry — so what it shows is spelled out rather than left to
                  the selected item's own markup, which is two lines tall. */}
              <ApiKeyLabel
                variant="inline"
                name={
                  apiKeyId
                    ? (selectedKey?.name ?? apiKeyId)
                    : t("model_usage.filters.allApiKeys")
                }
              />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("model_usage.filters.allApiKeys")}
            </SelectItem>
            {keyOptions.map((k) => (
              <SelectItem key={k.id} value={k.id}>
                <ApiKeyLabel name={k.name} description={k.description} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={endpointType || "all"}
          onValueChange={(v) => setEndpointType(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("model_usage.filters.endpointType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("model_usage.filters.allTypes")}
            </SelectItem>
            <SelectItem value="endpoint">
              {t("model_usage.detail.internal")}
            </SelectItem>
            <SelectItem value="external-endpoint">
              {t("model_usage.detail.external")}
            </SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="w-[200px]"
          placeholder={t("model_usage.filters.model")}
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
      </div>

      {error ? (
        <div className="text-sm text-destructive mb-2">{error.message}</div>
      ) : null}

      {/* Side by side and stretched to one height — a paired read is the point,
          and a shorter breakdown just leaves white space under its rows rather
          than a visibly short column. */}
      <div className="grid gap-4 md:grid-cols-2">
        <UsageTable
          title={scopeTitle(
            t("model_usage.byApiKey"),
            t("model_usage.byApiKeyOnDay", { date: range.start }),
          )}
          nameHeader={t("model_usage.apiKey")}
          rows={byKey}
          resetKey={scopeKey}
        />
        <UsageTable
          title={scopeTitle(
            t("model_usage.byModel"),
            t("model_usage.byModelOnDay", { date: range.start }),
          )}
          nameHeader={t("model_usage.model")}
          rows={byModel}
          resetKey={scopeKey}
        />
      </div>

      {canReadGroups ? (
        <div className="mt-4">
          <UsageTable
            title={
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  {scopeTitle(
                    t("model_usage.group.title"),
                    t("model_usage.group.titleOnDay", { date: range.start }),
                  )}
                </span>
                <Select
                  value={groupKind}
                  onValueChange={(v) => pickGroupKind(v as GroupUsageKind)}
                >
                  <SelectTrigger
                    className="h-7 w-[140px]"
                    aria-label={t("model_usage.group.kind")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {groupKinds.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {t(`model_usage.group.kinds.${kind}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {byUser && orgNodes.size > 0 ? (
                  <Select value={unitFilter} onValueChange={setUnitFilter}>
                    <SelectTrigger
                      className="h-7 w-[200px]"
                      aria-label={t("model_usage.group.filters.department")}
                      data-testid="usage-group-department"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_GROUPS}>
                        {t("model_usage.group.filters.allDepartments")}
                      </SelectItem>
                      {[...orgNodes.entries()].map(([name, { node }]) => (
                        <SelectItem key={name} value={name}>
                          {node.pathLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {byUser && canReadAllGroups && teamOptions.length > 0 ? (
                  <Select value={teamFilter} onValueChange={setTeamFilter}>
                    <SelectTrigger
                      className="h-7 w-[160px]"
                      aria-label={t("model_usage.group.filters.team")}
                      data-testid="usage-group-team"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_GROUPS}>
                        {t("model_usage.group.filters.allTeams")}
                      </SelectItem>
                      {teamOptions.map((team) => (
                        <SelectItem key={team.name} value={team.name}>
                          {team.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <span className="text-xs font-normal text-muted-foreground">
                  {byUser && groupFilter.orgUnit
                    ? `${t("model_usage.group.filters.subtreeIncluded")} `
                    : ""}
                  {groupKind === "OrgUnit"
                    ? t("model_usage.group.subtreeHint")
                    : t("model_usage.group.historyHint")}
                  {canReadAllGroups
                    ? ""
                    : ` ${t("model_usage.group.subtreeOnly")}`}
                  {apiKeyId ? ` ${t("model_usage.group.apiKeyIgnored")}` : ""}
                </span>
              </div>
            }
            nameHeader={t(`model_usage.group.kinds.${groupKind}`)}
            rows={byGroup}
            resetKey={groupScopeKey}
            showRequests
          />
          {groupUsage.error ? (
            <div className="mt-2 text-sm text-destructive">
              {groupUsage.error.message}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        <DetailTable rows={detailRows} resetKey={scopeKey} />
      </div>
    </ListPage>
  );
};

// The three tables share one page size and one reset rule: back to page 1 when
// the scope changes, never when the 60s poll refreshes the rows.
function usePagedRows<T>(rows: T[], resetKey: string, pageSize: number) {
  // Deriving the page from the scope key instead of resetting it in an effect:
  // the scope changed on the last render means we are back on page 1, and no
  // effect has to fire (or fight) the interaction that changed the scope.
  const [state, setState] = useState({ key: resetKey, page: 1 });
  const page = state.key === resetKey ? state.page : 1;
  const setPage = (next: number) => setState({ key: resetKey, page: next });
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  return {
    page: currentPage,
    pageCount,
    setPage,
    pagedRows: rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
  };
}

const CardPager = ({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="border-t border-[var(--nt-stroke-neutral-trans-2)] px-4 py-2">
      <PaginationControls
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
        showPageSize={false}
        summary={t("table.pagination.totalItems", { total })}
      />
    </div>
  );
};

const UsageTable = ({
  title,
  nameHeader,
  rows,
  resetKey,
  showRequests = false,
}: {
  title: ReactNode;
  nameHeader: string;
  rows: UsageSeries[];
  resetKey: string;
  showRequests?: boolean;
}) => {
  const { t } = useTranslation();
  const { page, pageCount, setPage, pagedRows } = usePagedRows(
    rows,
    resetKey,
    CARD_PAGE_SIZE,
  );
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex h-full flex-col overflow-hidden rounded-[var(--nt-radius-card)] border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)]"
    >
      <h2
        id={titleId}
        className="border-b border-[var(--nt-stroke-neutral-trans-2)] px-4 py-2 text-sm font-medium"
      >
        {title}
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{nameHeader}</TableHead>
            {showRequests ? (
              <TableHead className="w-[120px] text-right">
                {t("model_usage.group.requests")}
              </TableHead>
            ) : null}
            <TableHead className="w-[160px] text-right">
              {t("model_usage.promptTokens")}
            </TableHead>
            <TableHead className="w-[160px] text-right">
              {t("model_usage.completionTokens")}
            </TableHead>
            <TableHead className="w-[160px] text-right">
              {t("model_usage.totalTokens")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={showRequests ? 5 : 4}
                className="text-center py-8 text-muted-foreground"
              >
                {t("model_usage.empty")}
              </TableCell>
            </TableRow>
          ) : (
            pagedRows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="max-w-[160px]">
                  <ApiKeyLabel name={r.name} description={r.description} />
                </TableCell>
                {showRequests ? (
                  <TableCell className="text-right font-mono text-xs">
                    {(r.requests ?? 0).toLocaleString()}
                  </TableCell>
                ) : null}
                <TableCell className="text-right font-mono text-xs">
                  {formatTokens(r.prompt)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatTokens(r.completion)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-medium">
                  {formatTokens(r.total)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {pageCount > 1 ? (
        <CardPager
          page={page}
          pageCount={pageCount}
          pageSize={CARD_PAGE_SIZE}
          total={rows.length}
          onPageChange={setPage}
        />
      ) : null}
    </section>
  );
};

// DetailTable is the per-record breakdown (date / key / type / endpoint / model
// / prompt / completion / total) — the granularity the PM asked to keep from the
// old API-key detail view.
const DetailTable = ({
  rows,
  resetKey,
}: {
  rows: ApiUsageRecord[];
  resetKey: string;
}) => {
  const { t } = useTranslation();
  const { page, pageCount, setPage, pagedRows } = usePagedRows(
    rows,
    resetKey,
    DETAIL_PAGE_SIZE,
  );
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex h-full flex-col overflow-hidden rounded-[var(--nt-radius-card)] border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)]"
    >
      <h2
        id={titleId}
        className="border-b border-[var(--nt-stroke-neutral-trans-2)] px-4 py-2 text-sm font-medium"
      >
        {t("model_usage.detail.title")}
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[110px]">
              {t("model_usage.detail.date")}
            </TableHead>
            <TableHead className="w-[140px]">
              {t("model_usage.apiKey")}
            </TableHead>
            <TableHead className="w-[90px]">
              {t("model_usage.detail.type")}
            </TableHead>
            <TableHead>{t("model_usage.detail.endpoint")}</TableHead>
            <TableHead>{t("model_usage.model")}</TableHead>
            <TableHead className="text-right">
              {t("model_usage.promptTokens")}
            </TableHead>
            <TableHead className="text-right">
              {t("model_usage.completionTokens")}
            </TableHead>
            <TableHead className="text-right">
              {t("model_usage.totalTokens")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="text-center py-8 text-muted-foreground"
              >
                {t("model_usage.empty")}
              </TableCell>
            </TableRow>
          ) : (
            pagedRows.map((r, i) => (
              <TableRow
                key={`${r.date}-${r.api_key_id}-${r.endpoint_name}-${r.model_name}-${i}`}
              >
                <TableCell className="font-mono text-xs">
                  {formatTick(r.date)}
                </TableCell>
                <TableCell className="max-w-[140px] text-sm">
                  <ApiKeyLabel
                    name={r.api_key_name}
                    displayName={r.api_key_display_name}
                    description={r.api_key_description}
                  />
                </TableCell>
                <TableCell>
                  <EndpointTypeBadge type={r.endpoint_type} />
                </TableCell>
                <TableCell className="text-sm truncate max-w-[200px]">
                  {r.endpoint_name || <EmptyValue />}
                </TableCell>
                <TableCell className="text-sm truncate max-w-[200px]">
                  {r.model_name || <EmptyValue />}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatTokens(r.prompt_tokens ?? 0)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatTokens(r.completion_tokens ?? 0)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-medium">
                  {formatTokens(r.usage ?? 0)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {pageCount > 1 ? (
        <CardPager
          page={page}
          pageCount={pageCount}
          pageSize={DETAIL_PAGE_SIZE}
          total={rows.length}
          onPageChange={setPage}
        />
      ) : null}
    </section>
  );
};

const EndpointTypeBadge = ({ type }: { type: string | null }) => {
  const { t } = useTranslation();
  if (type === "external-endpoint") {
    return <Badge variant="outline">{t("model_usage.detail.external")}</Badge>;
  }
  if (type === "endpoint") {
    return (
      <Badge variant="secondary">{t("model_usage.detail.internal")}</Badge>
    );
  }
  return <EmptyValue />;
};
