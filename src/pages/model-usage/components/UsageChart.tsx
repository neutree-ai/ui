import { BarChart3, LineChart as LineChartIcon } from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/foundation/components/EmptyState";
import { Loader } from "@/foundation/components/Loader";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatTokens } from "@/foundation/lib/unit";
import {
  OTHER_SERIES_KEY,
  type UsageSeries,
} from "@/pages/model-usage/lib/usage-series";

const CHART_MARGIN = { top: 4, right: 8, bottom: 0, left: 4 };

// Distinct colors for the charted series. Series are capped at TOP_K + 1 by the
// fold, so with TOP_K = 8 the palette below is never cycled.
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
const OTHER_COLOR = "hsl(240 5% 50%)";

// A series' identity color — used by both charts, so the key that is blue in
// the trend is blue in the single-day bars too. "Other" is always neutral.
function seriesColor(series: UsageSeries[], key: string): string {
  const index = series.findIndex((s) => s.key === key);
  if (key === OTHER_SERIES_KEY || index < 0) return OTHER_COLOR;
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

// Prompt vs completion are two parts of one metric, so they share the series
// hue two steps apart: the base step reads as "prompt", the softened step as
// "completion". Mixing toward the card color keeps it legible in both themes.
const soften = (color: string) =>
  `color-mix(in srgb, ${color} 45%, var(--nt-fill-neutral-white))`;

// The category axis has no ellipsis of its own — a long key name would run into
// its neighbours, so shorten it and leave the full name to the tooltip.
const shortLabel = (value: string, max = 8) =>
  value.length > max ? `${value.slice(0, max)}…` : value;

// Converts a YYYY-MM-DD date into a compact M/D axis tick.
export function formatTick(date: string): string {
  const parts = date.split("-");
  return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : date;
}

type DayCategory = UsageSeries & {
  label: string;
  promptColor: string;
  completionColor: string;
};

type TooltipPayload = {
  dataKey?: string | number;
  value?: number;
  color?: string;
  payload?: DayCategory;
};

const TrendTooltip = ({
  active,
  payload,
  label,
  meta,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  meta: Map<string, UsageSeries>;
}) => {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => (p.value ?? 0) > 0);
  if (rows.length === 0) return null;
  // "Other" always sits last: it is not a contributor that competes with the
  // individual keys for a rank.
  const ordered = [
    ...rows
      .filter((p) => String(p.dataKey) !== OTHER_SERIES_KEY)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
    ...rows.filter((p) => String(p.dataKey) === OTHER_SERIES_KEY),
  ];
  const total = ordered.reduce((sum, p) => sum + (p.value ?? 0), 0);
  return (
    <div className="rounded border bg-popover px-2 py-1 text-xs shadow">
      <div className="font-medium mb-1">{label}</div>
      {ordered.map((p) => {
        const key = String(p.dataKey);
        const series = meta.get(key);
        return (
          <div
            key={key}
            className="flex items-center gap-1.5 text-muted-foreground"
          >
            <span
              className="inline-block size-2 shrink-0 rounded-sm"
              style={{ backgroundColor: p.color }}
            />
            {/* Single line per series: a second line per row doubles the
                tooltip height and pushes it out of the chart card. */}
            <span className="max-w-[180px] truncate text-foreground">
              {series?.name ?? key}
              {series?.description ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {series.description}
                </span>
              ) : null}
            </span>
            <span className="ml-auto font-mono">
              {formatTokens(p.value ?? 0)}
            </span>
          </div>
        );
      })}
      <div className="mt-1 flex border-t pt-1">
        <span>{t("model_usage.daily.tooltip.total")}</span>
        <span className="ml-auto font-mono">{formatTokens(total)}</span>
      </div>
    </div>
  );
};

const DayTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) => {
  const { t } = useTranslation();
  const category = active ? payload?.[0]?.payload : undefined;
  if (!category) return null;
  const title = category.description
    ? `${category.name} · ${category.description}`
    : category.name;
  return (
    <div className="rounded border bg-popover px-2 py-1 text-xs shadow">
      <div className="font-medium mb-1 max-w-[220px] truncate" title={title}>
        {title}
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span
          className="inline-block size-2 shrink-0 rounded-sm"
          style={{ backgroundColor: category.promptColor }}
        />
        <span>{t("model_usage.promptTokens")}</span>
        <span className="ml-auto font-mono text-foreground">
          {formatTokens(category.prompt)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span
          className="inline-block size-2 shrink-0 rounded-sm"
          style={{ backgroundColor: category.completionColor }}
        />
        <span>{t("model_usage.completionTokens")}</span>
        <span className="ml-auto font-mono text-foreground">
          {formatTokens(category.completion)}
        </span>
      </div>
      <div className="mt-1 flex border-t pt-1">
        <span>{t("model_usage.daily.tooltip.total")}</span>
        <span className="ml-auto font-mono">
          {formatTokens(category.total)}
        </span>
      </div>
    </div>
  );
};

export const UsageChart = ({
  series,
  trendData,
  dayCategories,
  isSingleDay,
  groupByModel,
  chartType,
  onChartTypeChange,
  hidden,
  onToggleSeries,
  totalTokens,
  isLoading,
  backLabel,
  onPickDay,
  onResetRange,
}: {
  series: UsageSeries[];
  trendData: Array<Record<string, number | string>>;
  dayCategories: UsageSeries[];
  isSingleDay: boolean;
  groupByModel: boolean;
  chartType: "line" | "bar";
  onChartTypeChange: (chartType: "line" | "bar") => void;
  hidden: Set<string>;
  onToggleSeries: (key: string) => void;
  totalTokens: number;
  isLoading: boolean;
  backLabel: string;
  onPickDay: (date: string) => void;
  onResetRange: () => void;
}) => {
  const { t } = useTranslation();
  const meta = useMemo(() => new Map(series.map((s) => [s.key, s])), [series]);
  const dayBars: DayCategory[] = useMemo(
    () =>
      dayCategories.map((category) => {
        const color = seriesColor(series, category.key);
        return {
          ...category,
          label:
            category.key === OTHER_SERIES_KEY
              ? t("model_usage.daily.otherAxisLabel", {
                  n: category.hiddenCount ?? 0,
                })
              : shortLabel(category.name),
          promptColor: color,
          completionColor: soften(color),
        };
      }),
    [dayCategories, series, t],
  );

  const title = isSingleDay
    ? groupByModel
      ? t("model_usage.daily.titleDayByModel")
      : t("model_usage.daily.titleDayByKey")
    : groupByModel
      ? t("model_usage.daily.titleByModel")
      : t("model_usage.daily.titleByKey");

  const isEmpty = isSingleDay ? dayBars.length === 0 : trendData.length === 0;

  // Recharts hands the chart state to onClick; the picked day is activeLabel.
  const handleChartClick = (state: { activeLabel?: string | number }) => {
    const day = typeof state?.activeLabel === "string" ? state.activeLabel : "";
    if (day) onPickDay(day);
  };

  // Axes / tooltip / legend are identical across line and stacked-bar modes, so
  // share them as a keyed child array between the two chart elements (recharts
  // flattens arrays of children when detecting axis/legend components).
  const trendAxes = [
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
    <Tooltip key="tip" content={<TrendTooltip meta={meta} />} />,
    <Legend
      key="legend"
      wrapperStyle={{ fontSize: 11 }}
      onClick={(entry) => onToggleSeries(String(entry.dataKey ?? ""))}
      formatter={(_value, entry) => {
        const key = String(entry?.dataKey ?? "");
        const seriesMeta = meta.get(key);
        return (
          <span
            className="inline-flex items-baseline align-middle leading-tight"
            style={{
              cursor: "pointer",
              opacity: hidden.has(key) ? 0.35 : 1,
            }}
          >
            <span>{seriesMeta?.name ?? key}</span>
            {seriesMeta?.description ? (
              <span className="ml-1 text-[10px] font-normal">
                - {seriesMeta.description}
              </span>
            ) : null}
          </span>
        );
      }}
    />,
  ];

  return (
    <div className="mb-4 rounded-[var(--nt-radius-card)] border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)] p-4">
      <div className="flex items-baseline justify-between mb-2 gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-medium">{title}</span>
          {isSingleDay ? (
            // The range itself is the state; this is the way back that stays
            // visible for someone who only ever looks at the chart.
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs font-normal"
              onClick={onResetRange}
              title={backLabel}
            >
              {backLabel}
            </Button>
          ) : (
            <span className="text-xs font-normal text-muted-foreground">
              {t("model_usage.daily.clickHint")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-semibold tabular-nums">
              {formatTokens(totalTokens)}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("model_usage.daily.totalLabel")}
            </span>
          </div>
          {/* The single-day chart is a distribution across API keys (or
              models), not a trend, so there is nothing to switch. */}
          {isSingleDay ? null : (
            <div className="inline-flex rounded-md border p-0.5">
              <Button
                type="button"
                variant={chartType === "line" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2"
                aria-label={t("model_usage.chart.line")}
                title={t("model_usage.chart.line")}
                onClick={() => onChartTypeChange("line")}
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
                onClick={() => onChartTypeChange("bar")}
              >
                <BarChart3 className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="h-[240px]">
        {isLoading && isEmpty ? (
          <div className="flex h-full items-center justify-center">
            <Loader className="w-8 text-muted-foreground" />
          </div>
        ) : isEmpty ? (
          <EmptyState className="flex h-full items-center justify-center">
            {t("model_usage.empty")}
          </EmptyState>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {isSingleDay ? (
              <BarChart data={dayBars} margin={CHART_MARGIN}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  interval={0}
                />
                <YAxis
                  tickFormatter={(v) => formatTokens(v) ?? ""}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={48}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  content={<DayTooltip />}
                />
                {/* Prompt and completion stack into one bar per category; each
                    Cell paints that category's segment. */}
                <Bar dataKey="prompt" stackId="day">
                  {dayBars.map((category) => (
                    <Cell key={category.key} fill={category.promptColor} />
                  ))}
                </Bar>
                <Bar dataKey="completion" stackId="day" radius={[3, 3, 0, 0]}>
                  {dayBars.map((category) => (
                    <Cell key={category.key} fill={category.completionColor} />
                  ))}
                </Bar>
              </BarChart>
            ) : chartType === "bar" ? (
              <BarChart
                data={trendData}
                margin={CHART_MARGIN}
                onClick={handleChartClick}
              >
                {trendAxes}
                {series.map((s) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.name}
                    stackId="usage"
                    hide={hidden.has(s.key)}
                    fill={seriesColor(series, s.key)}
                    radius={
                      s.key === series[series.length - 1]?.key
                        ? [3, 3, 0, 0]
                        : undefined
                    }
                  />
                ))}
              </BarChart>
            ) : (
              <LineChart
                data={trendData}
                margin={CHART_MARGIN}
                onClick={handleChartClick}
              >
                {trendAxes}
                {series.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    hide={hidden.has(s.key)}
                    stroke={seriesColor(series, s.key)}
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
  );
};
