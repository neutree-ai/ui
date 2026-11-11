import { useTranslation } from "react-i18next";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  PerformanceTrendMetric,
  PerformanceTrendSeries,
  PerformanceWindow,
} from "@/domains/endpoint/hooks/use-endpoint-performance-trends";
import {
  formatPerformanceTrendAxisTick,
  formatPerformanceTrendTimestamp,
  performanceTrendRows,
  performanceTrendTicks,
} from "@/domains/endpoint/lib/performance-trends";
import { Loader } from "@/foundation/components/Loader";
import { chartCategoryColor } from "@/foundation/lib/chart-palette";

export type PerformanceTrendLine = {
  metric: PerformanceTrendMetric;
  label: string;
  formatValue: (value: number) => string;
  formatAxisValue?: (value: number) => string;
  colorIndex?: number;
  axis?: "left" | "right";
  dashed?: boolean;
  groupLabel?: string;
};

type PerformanceTrendChartProps = {
  ariaLabel: string;
  series: PerformanceTrendSeries[];
  lines: PerformanceTrendLine[];
  window: PerformanceWindow;
  status: string;
};

type TooltipPayload = {
  dataKey?: string | number;
  value?: number;
  color?: string;
};

export function EndpointPerformanceTrendChart({
  ariaLabel,
  series,
  lines,
  window,
  status,
}: PerformanceTrendChartProps) {
  const { t } = useTranslation();
  const metrics = lines.map((line) => line.metric);
  const rows = performanceTrendRows(series, metrics);
  const leftAxisLine = lines.find((line) => line.axis === "left");
  const rightAxisLine = lines.find((line) => line.axis === "right");
  const yAxisWidth = 34;
  const leftAxisWidth = leftAxisLine ? yAxisWidth : 0;
  const rightAxisWidth = rightAxisLine ? yAxisWidth : 0;

  if (status === "loading") {
    return (
      <div className="flex h-[112px] items-center justify-center">
        <Loader className="w-7 text-muted-foreground" />
      </div>
    );
  }

  if (status !== "ok" || rows.length === 0) {
    const message =
      status === "unavailable" || status === "not_configured"
        ? t("endpoints.performance.trendUnavailable")
        : t("endpoints.performance.noTrendData");
    return (
      <div className="flex h-[112px] items-center justify-center px-4 text-center">
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      </div>
    );
  }

  const ticks = performanceTrendTicks(rows);

  if (leftAxisLine && rightAxisLine) {
    return (
      <SplitLatencyTrend
        ariaLabel={ariaLabel}
        leftLines={lines.filter((line) => line.axis === "left")}
        rightLines={lines.filter((line) => line.axis === "right")}
        rows={rows}
        ticks={ticks}
        window={window}
      />
    );
  }

  return (
    <div aria-label={ariaLabel} role="img">
      <div className="h-[104px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            accessibilityLayer
            data={rows}
            margin={{ top: 6, right: 0, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="hsl(var(--border))"
              strokeDasharray="2 4"
            />
            {leftAxisLine && (
              <YAxis
                axisLine={false}
                domain={["auto", "auto"]}
                orientation="left"
                tick={{
                  fill: chartCategoryColor(leftAxisLine.colorIndex ?? 0),
                  fontSize: 10,
                }}
                tickFormatter={(value) =>
                  (leftAxisLine.formatAxisValue ?? leftAxisLine.formatValue)(
                    Number(value),
                  )
                }
                tickLine={false}
                width={yAxisWidth}
                yAxisId="left"
              />
            )}
            {rightAxisLine && (
              <YAxis
                axisLine={false}
                domain={["auto", "auto"]}
                orientation="right"
                tick={{
                  fill: chartCategoryColor(rightAxisLine.colorIndex ?? 1),
                  fontSize: 10,
                }}
                tickFormatter={(value) =>
                  (rightAxisLine.formatAxisValue ?? rightAxisLine.formatValue)(
                    Number(value),
                  )
                }
                tickLine={false}
                width={yAxisWidth}
                yAxisId="right"
              />
            )}
            <XAxis
              dataKey="timestamp"
              domain={["dataMin", "dataMax"]}
              hide
              type="number"
            />
            <Tooltip
              content={
                <PerformanceTrendTooltip
                  formatTimestamp={(value) =>
                    formatPerformanceTrendTimestamp(value, window)
                  }
                  lines={lines}
                />
              }
              cursor={{ stroke: "var(--nt-stroke-neutral-trans-3)" }}
            />
            {lines.map((line, index) => (
              <Line
                activeDot={{ r: 4 }}
                connectNulls={false}
                dataKey={line.metric}
                dot={false}
                key={line.metric}
                name={line.label}
                stroke={chartCategoryColor(line.colorIndex ?? index)}
                strokeDasharray={line.dashed ? "4 3" : undefined}
                strokeWidth={2}
                type="monotone"
                yAxisId={line.axis}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <TrendTimeline
        leftPadding={leftAxisWidth}
        rightPadding={rightAxisWidth}
        ticks={ticks}
        window={window}
      />
      <TrendLegend lines={lines} />
    </div>
  );
}

function SplitLatencyTrend({
  ariaLabel,
  leftLines,
  rightLines,
  rows,
  ticks,
  window,
}: {
  ariaLabel: string;
  leftLines: PerformanceTrendLine[];
  rightLines: PerformanceTrendLine[];
  rows: ReturnType<typeof performanceTrendRows>;
  ticks: number[];
  window: PerformanceWindow;
}) {
  return (
    <div aria-label={ariaLabel} role="img">
      <SplitLatencyRow lines={leftLines} rows={rows} window={window} />
      <SplitLatencyRow
        bordered
        lines={rightLines}
        rows={rows}
        window={window}
      />
      <TrendTimeline
        leftPadding={76}
        rightPadding={4}
        ticks={ticks}
        window={window}
      />
      <TrendLegend lines={[...leftLines, ...rightLines]} />
    </div>
  );
}

function SplitLatencyRow({
  bordered = false,
  lines,
  rows,
  window,
}: {
  bordered?: boolean;
  lines: PerformanceTrendLine[];
  rows: ReturnType<typeof performanceTrendRows>;
  window: PerformanceWindow;
}) {
  const first = lines[0];
  if (!first) return null;

  return (
    <div
      className={`grid grid-cols-[42px_minmax(0,1fr)] items-center gap-1 ${
        bordered ? "border-t border-[var(--nt-stroke-neutral-trans-2)]" : ""
      }`}
    >
      <span
        className="pl-1 text-[10px] font-semibold"
        style={{ color: chartCategoryColor(first.colorIndex ?? 0) }}
      >
        {first.groupLabel}
      </span>
      <div className="h-[58px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            accessibilityLayer
            data={rows}
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="hsl(var(--border))"
              strokeDasharray="2 4"
            />
            <YAxis
              axisLine={false}
              domain={["auto", "auto"]}
              orientation="left"
              tick={{
                fill: chartCategoryColor(first.colorIndex ?? 0),
                fontSize: 10,
              }}
              tickFormatter={(value) =>
                (first.formatAxisValue ?? first.formatValue)(Number(value))
              }
              tickLine={false}
              width={30}
            />
            <XAxis
              dataKey="timestamp"
              domain={["dataMin", "dataMax"]}
              hide
              type="number"
            />
            <Tooltip
              content={
                <PerformanceTrendTooltip
                  formatTimestamp={(value) =>
                    formatPerformanceTrendTimestamp(value, window)
                  }
                  lines={lines}
                />
              }
              cursor={{ stroke: "var(--nt-stroke-neutral-trans-3)" }}
            />
            {lines.map((line) => (
              <Line
                activeDot={{ r: 4 }}
                connectNulls={false}
                dataKey={line.metric}
                dot={false}
                key={line.metric}
                name={line.label}
                stroke={chartCategoryColor(line.colorIndex ?? 0)}
                strokeDasharray={line.dashed ? "4 3" : undefined}
                strokeWidth={2}
                type="monotone"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TrendTimeline({
  leftPadding,
  rightPadding,
  ticks,
  window,
}: {
  leftPadding: number;
  rightPadding: number;
  ticks: number[];
  window: PerformanceWindow;
}) {
  return (
    <div
      className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground"
      style={{ paddingLeft: leftPadding, paddingRight: rightPadding }}
    >
      {ticks.map((tick) => (
        <span key={tick}>{formatPerformanceTrendAxisTick(tick, window)}</span>
      ))}
    </div>
  );
}

function TrendLegend({ lines }: { lines: PerformanceTrendLine[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 pt-2">
      {lines.map((line, index) => (
        <span
          className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground"
          key={line.metric}
        >
          <span
            aria-hidden="true"
            className="h-0.5 w-3 rounded-full"
            style={{
              background: line.dashed
                ? `repeating-linear-gradient(90deg, ${chartCategoryColor(line.colorIndex ?? index)} 0 4px, transparent 4px 7px)`
                : chartCategoryColor(line.colorIndex ?? index),
            }}
          />
          {line.label}
        </span>
      ))}
    </div>
  );
}

function PerformanceTrendTooltip({
  active,
  payload,
  label,
  lines,
  formatTimestamp,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: number;
  lines: PerformanceTrendLine[];
  formatTimestamp: (timestamp: number) => string;
}) {
  if (!active || !payload?.length || label == null) return null;

  const rows = payload.filter(
    (item): item is TooltipPayload & { dataKey: string; value: number } =>
      typeof item.dataKey === "string" && typeof item.value === "number",
  );

  return (
    <div className="rounded border bg-popover px-2 py-1.5 text-xs shadow">
      <div className="mb-1 font-medium">{formatTimestamp(label)}</div>
      {lines.map((line, index) => {
        const item = rows.find((row) => row.dataKey === line.metric);
        if (!item) return null;

        return (
          <div
            className="flex items-center gap-1.5 text-muted-foreground"
            key={line.metric}
          >
            <span
              className="inline-block h-0.5 w-3 shrink-0 rounded-full"
              style={{
                background: line.dashed
                  ? `repeating-linear-gradient(90deg, ${chartCategoryColor(line.colorIndex ?? index)} 0 4px, transparent 4px 7px)`
                  : chartCategoryColor(line.colorIndex ?? index),
              }}
            />
            <span>{line.label}</span>
            <span className="ml-auto font-mono text-foreground">
              {line.formatValue(item.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
