import { Activity, Clock, Database, type LucideIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type PerformanceTimeRange,
  useEndpointPerformanceTrends,
} from "@/domains/endpoint/hooks/use-endpoint-performance-trends";
import {
  performanceRangeDisplayWindow,
  performanceTrendLatestRow,
} from "@/domains/endpoint/lib/performance-trends";
import { ObservationStatus } from "@/foundation/components/ObservationStatus";
import { Section } from "@/foundation/components/Section";
import { SegmentedControl } from "@/foundation/components/SegmentedControl";
import { cn } from "@/foundation/lib/utils";
import {
  formatBandwidth,
  formatLatency,
  formatLatencyAxis,
  formatPercent,
  formatTokenRate,
} from "../lib/performance-format";
import { EndpointPerformanceTimeRange } from "./EndpointPerformanceTimeRange";
import {
  EndpointPerformanceTrendChart,
  type PerformanceTrendLine,
} from "./EndpointPerformanceTrendChart";

export function EndpointPerformanceCard({
  workspace,
  name,
  paused = false,
  showKvCache = true,
}: {
  workspace?: string | null;
  name?: string | null;
  paused?: boolean;
  showKvCache?: boolean;
}) {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<PerformanceTimeRange>({
    kind: "preset",
    window: "5m",
  });
  const [cacheMetric, setCacheMetric] = useState<"hitRate" | "throughput">(
    "hitRate",
  );
  const { series, status: trendStatus } = useEndpointPerformanceTrends(
    workspace,
    name,
    timeRange,
    !paused,
  );
  const displayWindow = performanceRangeDisplayWindow(timeRange);
  const latencyLines = useMemo(() => LATENCY_LINES(t), [t]);
  const throughputLines = useMemo(() => THROUGHPUT_LINES(t), [t]);
  const cacheHitLines = useMemo(() => CACHE_HIT_LINES(t), [t]);
  const cacheIOLines = useMemo(() => CACHE_IO_LINES(t), [t]);
  const latencyCurrent = useMemo(
    () =>
      performanceTrendLatestRow(
        series,
        latencyLines.map((line) => line.metric),
      ),
    [series, latencyLines],
  );
  const throughputCurrent = useMemo(
    () =>
      performanceTrendLatestRow(
        series,
        throughputLines.map((line) => line.metric),
      ),
    [series, throughputLines],
  );
  const cacheHitCurrent = useMemo(
    () =>
      performanceTrendLatestRow(
        series,
        cacheHitLines.map((line) => line.metric),
      ),
    [series, cacheHitLines],
  );
  const cacheIOCurrent = useMemo(
    () =>
      performanceTrendLatestRow(
        series,
        cacheIOLines.map((line) => line.metric),
      ),
    [series, cacheIOLines],
  );

  return (
    <Section
      data-testid="endpoint-performance-card"
      title={t("endpoints.sections.monitoringMetrics")}
      actions={
        <EndpointPerformanceTimeRange
          onChange={setTimeRange}
          value={timeRange}
        />
      }
    >
      <ObservationStatus status={trendStatus} />
      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          showKvCache ? "lg:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-2",
        )}
      >
        <MetricTile icon={Clock} title={t("endpoints.performance.latency")}>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <LatencyStat
                label={t("endpoints.performance.ttft")}
                p95={latencyCurrent?.ttft_p95_seconds}
                avg={latencyCurrent?.ttft_avg_seconds}
                testId="perf-ttft-value"
              />
              <LatencyStat
                label={t("endpoints.performance.tpot")}
                p95={latencyCurrent?.tpot_p95_seconds}
                avg={latencyCurrent?.tpot_avg_seconds}
                testId="perf-tpot-value"
              />
            </div>
            <EndpointPerformanceTrendChart
              ariaLabel={t("endpoints.performance.trendAriaLabel", {
                metric: t("endpoints.performance.latency"),
              })}
              lines={latencyLines}
              series={series}
              status={trendStatus}
              window={displayWindow}
            />
          </div>
        </MetricTile>

        <MetricTile
          icon={Activity}
          title={t("endpoints.performance.throughput")}
        >
          <div className="mt-3 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {t("endpoints.performance.totalTokensPerSecond")}
              </span>
              <span
                data-testid="perf-tps-value"
                className="text-xl font-semibold tabular-nums text-foreground"
              >
                {formatTokenRate(throughputCurrent?.total_tokens_per_second)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t pt-2.5 text-xs">
              <SmallStat
                label={t("endpoints.performance.promptTokensPerSecond")}
                value={formatTokenRate(
                  throughputCurrent?.prompt_tokens_per_second,
                )}
                testId="perf-prompt-tps-value"
              />
              <SmallStat
                label={t("endpoints.performance.generationTokensPerSecond")}
                value={formatTokenRate(
                  throughputCurrent?.generation_tokens_per_second,
                )}
                testId="perf-gen-tps-value"
              />
            </div>
            <EndpointPerformanceTrendChart
              ariaLabel={t("endpoints.performance.trendAriaLabel", {
                metric: t("endpoints.performance.throughput"),
              })}
              lines={throughputLines}
              series={series}
              status={trendStatus}
              window={displayWindow}
            />
          </div>
        </MetricTile>

        {showKvCache && (
          <MetricTile
            className="lg:col-span-2 xl:col-span-1"
            icon={Database}
            title={t("endpoints.performance.kvCache")}
            actions={
              <SegmentedControl
                ariaLabel={t("endpoints.performance.kvCache")}
                size="sm"
                value={cacheMetric}
                onValueChange={setCacheMetric}
                items={[
                  {
                    value: "hitRate",
                    label: t("endpoints.performance.hitRateMetric"),
                  },
                  {
                    value: "throughput",
                    label: t("endpoints.performance.readWriteMetric"),
                  },
                ]}
              />
            }
          >
            {cacheMetric === "hitRate" ? (
              <div className="mt-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-3">
                  <MetricStat
                    label={t("endpoints.performance.l0HitRate")}
                    testId="perf-l0-hit-rate"
                    value={formatPercent(cacheHitCurrent?.l0_hit_rate)}
                  />
                  <MetricStat
                    label={t("endpoints.performance.l1HitRate")}
                    testId="perf-l1-hit-rate"
                    value={formatPercent(cacheHitCurrent?.l1_hit_rate)}
                  />
                </div>
                <EndpointPerformanceTrendChart
                  ariaLabel={t("endpoints.performance.trendAriaLabel", {
                    metric: t("endpoints.performance.hitRateMetric"),
                  })}
                  lines={cacheHitLines}
                  series={series}
                  status={trendStatus}
                  window={displayWindow}
                />
              </div>
            ) : (
              <div className="mt-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-3">
                  <MetricStat
                    label={t("endpoints.performance.l1ReadSpeed")}
                    testId="perf-l1-read-speed"
                    value={formatBandwidth(
                      cacheIOCurrent?.l1_read_bytes_per_second,
                    )}
                  />
                  <MetricStat
                    label={t("endpoints.performance.l1WriteSpeed")}
                    testId="perf-l1-write-speed"
                    value={formatBandwidth(
                      cacheIOCurrent?.l1_write_bytes_per_second,
                    )}
                  />
                </div>
                <EndpointPerformanceTrendChart
                  ariaLabel={t("endpoints.performance.trendAriaLabel", {
                    metric: t("endpoints.performance.readWriteMetric"),
                  })}
                  lines={cacheIOLines}
                  series={series}
                  status={trendStatus}
                  window={displayWindow}
                />
              </div>
            )}
          </MetricTile>
        )}
      </div>
    </Section>
  );
}

function MetricTile({
  icon: Icon,
  title,
  actions,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-lg border bg-muted/20 p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

// The headline is the p95 when the backend reports one, otherwise the mean.
function LatencyStat({
  label,
  p95,
  avg,
  testId,
}: {
  label: string;
  p95?: number;
  avg?: number;
  testId: string;
}) {
  const { t } = useTranslation();
  const primaryStatistic = p95 != null ? "p95" : "avg";

  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">
        {label} ·{" "}
        {primaryStatistic === "p95"
          ? t("endpoints.performance.p95")
          : t("endpoints.performance.avg")}
      </div>
      <div
        data-testid={testId}
        className="mt-1 text-xl font-semibold tabular-nums text-foreground"
      >
        {formatLatency(p95 ?? avg)}
      </div>
      {primaryStatistic === "p95" && (
        <div className="mt-1 text-xs tabular-nums text-muted-foreground">
          {t("endpoints.performance.avg")} {formatLatency(avg)}
        </div>
      )}
    </div>
  );
}

function MetricStat({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div
        data-testid={testId}
        className="mt-1 text-xl font-semibold tabular-nums text-foreground"
      >
        {value}
      </div>
    </div>
  );
}

function SmallStat({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div
        data-testid={testId}
        className="mt-0.5 font-semibold tabular-nums text-foreground"
      >
        {value}
      </div>
    </div>
  );
}

const LATENCY_LINES = (t: (key: string) => string): PerformanceTrendLine[] => [
  {
    metric: "ttft_p95_seconds",
    label: `${t("endpoints.performance.ttft")} ${t("endpoints.performance.p95")}`,
    formatValue: formatLatency,
    formatAxisValue: formatLatencyAxis,
    colorIndex: 0,
    axis: "left",
    groupLabel: t("endpoints.performance.ttft"),
  },
  {
    metric: "ttft_avg_seconds",
    label: `${t("endpoints.performance.ttft")} ${t("endpoints.performance.avg")}`,
    formatValue: formatLatency,
    formatAxisValue: formatLatencyAxis,
    colorIndex: 0,
    axis: "left",
    dashed: true,
    groupLabel: t("endpoints.performance.ttft"),
  },
  {
    metric: "tpot_p95_seconds",
    label: `${t("endpoints.performance.tpot")} ${t("endpoints.performance.p95")}`,
    formatValue: formatLatency,
    formatAxisValue: formatLatencyAxis,
    colorIndex: 1,
    axis: "right",
    groupLabel: t("endpoints.performance.tpot"),
  },
  {
    metric: "tpot_avg_seconds",
    label: `${t("endpoints.performance.tpot")} ${t("endpoints.performance.avg")}`,
    formatValue: formatLatency,
    formatAxisValue: formatLatencyAxis,
    colorIndex: 1,
    axis: "right",
    dashed: true,
    groupLabel: t("endpoints.performance.tpot"),
  },
];

const THROUGHPUT_LINES = (
  t: (key: string) => string,
): PerformanceTrendLine[] => [
  {
    metric: "prompt_tokens_per_second",
    label: t("endpoints.performance.promptTokensPerSecond"),
    formatValue: formatTokenRate,
  },
  {
    metric: "generation_tokens_per_second",
    label: t("endpoints.performance.generationTokensPerSecond"),
    formatValue: formatTokenRate,
  },
  {
    metric: "total_tokens_per_second",
    label: t("endpoints.performance.totalTokensPerSecond"),
    formatValue: formatTokenRate,
  },
];

const CACHE_HIT_LINES = (
  t: (key: string) => string,
): PerformanceTrendLine[] => [
  {
    metric: "l0_hit_rate",
    label: t("endpoints.performance.l0HitRate"),
    formatValue: formatPercent,
  },
  {
    metric: "l1_hit_rate",
    label: t("endpoints.performance.l1HitRate"),
    formatValue: formatPercent,
  },
];

const CACHE_IO_LINES = (t: (key: string) => string): PerformanceTrendLine[] => [
  {
    metric: "l1_read_bytes_per_second",
    label: t("endpoints.performance.l1ReadSpeed"),
    formatValue: formatBandwidth,
  },
  {
    metric: "l1_write_bytes_per_second",
    label: t("endpoints.performance.l1WriteSpeed"),
    formatValue: formatBandwidth,
  },
];
