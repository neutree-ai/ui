import { useList, useParsed } from "@refinedev/core";
import {
  BarChart3,
  LineChart as LineChartIcon,
  RefreshCw,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { useWorkspaceUsage } from "@/domains/api-key/hooks/use-workspace-usage";
import type { ApiUsageRecord } from "@/domains/api-key/types";
import {
  type DateRange,
  DateRangePicker,
  trailingRange,
} from "@/foundation/components/DateRangePicker";
import { ListPage } from "@/foundation/components/ListPage";
import { Loader } from "@/foundation/components/Loader";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatTokens } from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";

type NamedTotals = {
  key: string;
  name: string;
  prompt: number;
  completion: number;
  total: number;
};

// A point on the daily line chart: `date` plus one numeric key per series
// (an API key in "all keys" mode, or a model when a single key is selected).
type DailyRow = {
  date: string;
  [series: string]: number | string;
};

// A chart series: stable `key` (used as the recharts dataKey + legend toggle
// identity) and a human `name` for the legend/tooltip.
type Series = { key: string; name: string };

// Distinct colors for the per-series lines; cycles if there are more series
// than colors.
const SERIES_COLORS = [
  "hsl(217 91% 60%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(271 81% 56%)",
  "hsl(0 84% 60%)",
  "hsl(199 89% 48%)",
  "hsl(330 81% 60%)",
  "hsl(160 84% 39%)",
  "hsl(48 96% 53%)",
  "hsl(240 5% 50%)",
];

const CHART_MARGIN = { top: 4, right: 8, bottom: 0, left: 4 };

export const ModelUsageList = () => {
  const { t } = useTranslation();
  const { params } = useParsed();
  const workspace = (params?.workspace as string) ?? "";

  const [range, setRange] = useState<DateRange>(() => trailingRange(30));
  const [apiKeyId, setApiKeyId] = useState<string>("");
  const [endpointType, setEndpointType] = useState<string>("");
  const [model, setModel] = useState("");
  // Chart display mode — line (trend per series) or stacked bar (daily volume).
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  // Series toggled off via the (clickable) chart legend.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  // Day focused by clicking a chart point — narrows the detail table.
  const [focusDate, setFocusDate] = useState<string>("");

  const { usageData, isLoading, error, refetch } = useWorkspaceUsage(
    workspace,
    range.start,
    range.end,
  );

  // Workspace API keys for the filter dropdown (matches the trace list).
  const { data: keysData } = useList<{
    id: string;
    metadata?: { name?: string };
  }>({
    resource: "api_keys",
    pagination: { mode: "off" },
    meta: { workspace },
    queryOptions: { enabled: Boolean(workspace) },
  });
  const keys = keysData?.data ?? [];

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

  // With "All API keys" each line is an API key; once a key is picked we drill
  // into that key's per-model usage over time.
  const groupByModel = Boolean(apiKeyId);
  const { data: dailyData, series } = useMemo(
    () => aggregateDaily(filtered, groupByModel),
    [filtered, groupByModel],
  );

  const byKey = useMemo(
    () =>
      aggregateBy(
        filtered,
        (r) => r.api_key_id,
        (r) => r.api_key_name,
      ),
    [filtered],
  );
  const byModel = useMemo(
    () =>
      aggregateBy(
        filtered,
        (r) => r.model_name ?? "-",
        (r) => r.model_name ?? "-",
      ),
    [filtered],
  );

  // Detail rows, optionally narrowed to the day clicked in the chart.
  const detailRows = useMemo(() => {
    const rows = focusDate
      ? filtered.filter((r) => r.date === focusDate)
      : filtered;
    return [...rows].sort(
      (a, b) => b.date.localeCompare(a.date) || (b.usage ?? 0) - (a.usage ?? 0),
    );
  }, [filtered, focusDate]);

  const totalTokens = filtered.reduce((sum, r) => sum + (r.usage ?? 0), 0);
  const seriesName = (key: string) =>
    series.find((s) => s.key === key)?.name ?? key;

  // Clicking a day in either chart focuses (or clears) the detail table.
  const onPick = (e: { activeLabel?: string | number }) => {
    const day = typeof e?.activeLabel === "string" ? e.activeLabel : "";
    if (day) setFocusDate((prev) => (prev === day ? "" : day));
  };

  const toggleSeries = (key: string) => {
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

  // Axes / grid / tooltip / legend are identical across line and bar modes, so
  // share them as a keyed child array between the two chart elements (recharts
  // flattens arrays of children when detecting axis/legend components).
  const commonAxes = [
    <CartesianGrid
      key="grid"
      strokeDasharray="3 3"
      vertical={false}
      stroke="hsl(var(--border))"
    />,
    <XAxis
      key="x"
      dataKey="date"
      tickFormatter={formatTick}
      tickLine={false}
      axisLine={false}
      fontSize={11}
      interval="preserveStartEnd"
    />,
    <YAxis
      key="y"
      tickFormatter={(v) => formatTokens(v) ?? ""}
      tickLine={false}
      axisLine={false}
      fontSize={11}
      width={48}
    />,
    <Tooltip key="tip" content={<UsageTooltip seriesName={seriesName} />} />,
    <Legend
      key="legend"
      wrapperStyle={{ fontSize: 11 }}
      onClick={(o) => toggleSeries(String(o.dataKey ?? ""))}
      formatter={(_val, entry) => {
        const key = String(entry?.dataKey ?? "");
        return (
          <span
            style={{
              cursor: "pointer",
              opacity: hidden.has(key) ? 0.35 : 1,
            }}
          >
            {seriesName(key)}
          </span>
        );
      }}
    />,
  ];

  return (
    <ListPage
      title={t("model_usage.title")}
      canCreate={false}
      breadcrumb={false}
      extra={
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
          {t("model_usage.refresh")}
        </Button>
      }
    >
      <div className="border rounded-md p-4 mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm font-medium">
            {groupByModel
              ? t("model_usage.daily.titleByModel")
              : t("model_usage.daily.titleByKey")}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold tabular-nums">
                {formatTokens(totalTokens)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("model_usage.daily.totalLabel")}
              </span>
            </div>
            <div className="inline-flex rounded-md border p-0.5">
              <Button
                type="button"
                variant={chartType === "line" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2"
                aria-label={t("model_usage.chart.line")}
                title={t("model_usage.chart.line")}
                onClick={() => setChartType("line")}
              >
                <LineChartIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant={chartType === "bar" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2"
                aria-label={t("model_usage.chart.bar")}
                title={t("model_usage.chart.bar")}
                onClick={() => setChartType("bar")}
              >
                <BarChart3 className="size-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="h-[240px]">
          {isLoading && dailyData.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Loader className="w-8 text-muted-foreground" />
            </div>
          ) : dailyData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("model_usage.empty")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "bar" ? (
                <BarChart
                  data={dailyData}
                  margin={CHART_MARGIN}
                  onClick={onPick}
                >
                  {commonAxes}
                  {series.map((s, i) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.name}
                      stackId="usage"
                      hide={hidden.has(s.key)}
                      fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                      radius={
                        i === series.length - 1 ? [3, 3, 0, 0] : undefined
                      }
                    />
                  ))}
                </BarChart>
              ) : (
                <LineChart
                  data={dailyData}
                  margin={CHART_MARGIN}
                  onClick={onPick}
                >
                  {commonAxes}
                  {series.map((s, i) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.name}
                      hide={hidden.has(s.key)}
                      stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <DateRangePicker value={range} onChange={setRange} />
        <Select
          value={apiKeyId || "all"}
          onValueChange={(v) => {
            const next = v === "all" ? "" : v;
            setApiKeyId(next);
            // A single key reads best as a stacked bar of its daily model mix;
            // "All keys" reads best as per-key trend lines.
            setChartType(next ? "bar" : "line");
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("model_usage.filters.apiKey")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("model_usage.filters.allApiKeys")}
            </SelectItem>
            {keys.map((k) => (
              <SelectItem key={k.id} value={k.id}>
                {k.metadata?.name ?? k.id}
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
        {focusDate ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 gap-1 px-3 font-normal"
            aria-label={t("model_usage.clearFocusDate")}
            title={t("model_usage.clearFocusDate")}
            onClick={() => setFocusDate("")}
          >
            {formatTick(focusDate)}
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="text-sm text-destructive mb-2">{error.message}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <UsageTable
          title={t("model_usage.byApiKey")}
          nameHeader={t("model_usage.apiKey")}
          rows={byKey}
        />
        <UsageTable
          title={t("model_usage.byModel")}
          nameHeader={t("model_usage.model")}
          rows={byModel}
        />
      </div>

      <div className="mt-4">
        <DetailTable rows={detailRows} />
      </div>
    </ListPage>
  );
};

// DetailTable is the per-day breakdown (date / type / endpoint / model /
// prompt / completion / total) — one row per usage record, the granularity the
// PM asked to keep from the old API-key detail view.
const DetailTable = ({ rows }: { rows: ApiUsageRecord[] }) => {
  const { t } = useTranslation();
  return (
    <div className="border rounded-md">
      <div className="px-4 py-2 text-sm font-medium border-b">
        {t("model_usage.detail.title")}
      </div>
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
            rows.map((r, i) => (
              <TableRow
                key={`${r.date}-${r.api_key_id}-${r.endpoint_name}-${r.model_name}-${i}`}
              >
                <TableCell className="font-mono text-xs">
                  {formatTick(r.date)}
                </TableCell>
                <TableCell className="text-sm truncate max-w-[140px]">
                  {r.api_key_name || (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <EndpointTypeBadge type={r.endpoint_type} />
                </TableCell>
                <TableCell className="text-sm truncate max-w-[200px]">
                  {r.endpoint_name || (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-sm truncate max-w-[200px]">
                  {r.model_name || (
                    <span className="text-muted-foreground">-</span>
                  )}
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
    </div>
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
  return <span className="text-muted-foreground">-</span>;
};

const UsageTable = ({
  title,
  nameHeader,
  rows,
}: {
  title: string;
  nameHeader: string;
  rows: NamedTotals[];
}) => {
  const { t } = useTranslation();
  return (
    <div className="border rounded-md">
      <div className="px-4 py-2 text-sm font-medium border-b">{title}</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{nameHeader}</TableHead>
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
                colSpan={4}
                className="text-center py-8 text-muted-foreground"
              >
                {t("model_usage.empty")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="truncate max-w-[160px]">
                  {r.name || <span className="text-muted-foreground">-</span>}
                </TableCell>
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
    </div>
  );
};

const UsageTooltip = ({
  active,
  payload,
  label,
  seriesName,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  seriesName: (key: string) => string;
}) => {
  const { t } = useTranslation();
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter((p) => (p.value ?? 0) > 0);
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, p) => sum + (p.value ?? 0), 0);
  return (
    <div className="rounded border bg-popover px-2 py-1 text-xs shadow">
      <div className="font-medium mb-1">{label}</div>
      {rows.map((p) => (
        <div
          key={p.dataKey}
          className="flex items-center gap-1.5 text-muted-foreground"
        >
          <span
            className="inline-block size-2 rounded-sm"
            style={{ backgroundColor: p.color }}
          />
          <span className="truncate max-w-[160px]">
            {seriesName(p.dataKey)}
          </span>
          <span className="ml-auto font-mono">{formatTokens(p.value)}</span>
        </div>
      ))}
      <div className="mt-1 flex border-t pt-1">
        <span>{t("model_usage.daily.tooltip.total")}</span>
        <span className="ml-auto font-mono">{formatTokens(total)}</span>
      </div>
    </div>
  );
};

// aggregateDaily buckets usage into per-day totals for each series — one series
// per API key, or per model when `byModel` is set — for a multi-line chart.
// Returns the chart rows and the series list (sorted by total desc).
function aggregateDaily(
  rows: ApiUsageRecord[],
  byModel: boolean,
): { data: DailyRow[]; series: Series[] } {
  const byDate = new Map<string, Record<string, number>>();
  const totals = new Map<string, number>();
  const names = new Map<string, string>();
  for (const r of rows) {
    const key = byModel ? (r.model_name ?? "-") : r.api_key_id;
    const name = byModel ? (r.model_name ?? "-") : r.api_key_name;
    names.set(key, name);
    const day = byDate.get(r.date) ?? {};
    day[key] = (day[key] ?? 0) + (r.usage ?? 0);
    byDate.set(r.date, day);
    totals.set(key, (totals.get(key) ?? 0) + (r.usage ?? 0));
  }
  const series = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => ({ key, name: names.get(key) ?? key }));
  const data = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, perSeries]) => {
      const row: DailyRow = { date };
      for (const s of series) {
        row[s.key] = perSeries[s.key] ?? 0;
      }
      return row;
    });
  return { data, series };
}

function aggregateBy(
  rows: ApiUsageRecord[],
  keyOf: (r: ApiUsageRecord) => string,
  nameOf: (r: ApiUsageRecord) => string,
): NamedTotals[] {
  const byKey = new Map<string, NamedTotals>();
  for (const r of rows) {
    const k = keyOf(r);
    const cur = byKey.get(k) ?? {
      key: k,
      name: nameOf(r),
      prompt: 0,
      completion: 0,
      total: 0,
    };
    cur.prompt += r.prompt_tokens ?? 0;
    cur.completion += r.completion_tokens ?? 0;
    cur.total += r.usage ?? 0;
    byKey.set(k, cur);
  }
  return [...byKey.values()].sort((a, b) => b.total - a.total);
}

// Converts a YYYY-MM-DD date into a compact M/D axis tick.
function formatTick(date: string): string {
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}
