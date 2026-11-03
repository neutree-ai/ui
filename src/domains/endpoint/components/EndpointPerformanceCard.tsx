import { Activity, Clock, Database, type LucideIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type PerformanceWindow,
  useEndpointPerformanceObservations,
} from "@/domains/endpoint/hooks/use-endpoint-performance-observations";
import { MetricBar } from "@/foundation/components/MetricBar";
import { ObservationStatus } from "@/foundation/components/ObservationStatus";
import { Section } from "@/foundation/components/Section";
import { SegmentedControl } from "@/foundation/components/SegmentedControl";
import {
  formatBandwidth,
  formatLatency,
  formatPercent,
  formatTokenRate,
} from "../lib/performance-format";

export function EndpointPerformanceCard({
  workspace,
  name,
  paused = false,
}: {
  workspace?: string | null;
  name?: string | null;
  paused?: boolean;
}) {
  const { t } = useTranslation();
  const [window, setWindow] = useState<PerformanceWindow>("5m");
  const { metrics, status } = useEndpointPerformanceObservations(
    workspace,
    name,
    window,
    !paused,
  );

  return (
    <Section
      data-testid="endpoint-performance-card"
      title={t("endpoints.sections.monitoringMetrics")}
      actions={
        <SegmentedControl
          ariaLabel={t("endpoints.sections.monitoringMetrics")}
          value={window}
          onValueChange={setWindow}
          items={[
            { value: "5m", label: t("endpoints.performance.window5m") },
            { value: "1h", label: t("endpoints.performance.window1h") },
            { value: "24h", label: t("endpoints.performance.window24h") },
          ]}
        />
      }
    >
      <ObservationStatus status={status} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MetricTile
          icon={Clock}
          title={t("endpoints.performance.latency")}
          cumulative={
            metrics.latency_cumulative && (
              <CumulativeBadge testId="perf-latency-cumulative" />
            )
          }
        >
          <div className="mt-3 grid grid-cols-2 gap-4">
            <LatencyStat
              label={t("endpoints.performance.ttft")}
              p95={metrics.ttft_p95_seconds}
              avg={metrics.ttft_avg_seconds}
              testId="perf-ttft-value"
            />
            <LatencyStat
              label={t("endpoints.performance.tpot")}
              p95={metrics.tpot_p95_seconds}
              avg={metrics.tpot_avg_seconds}
              testId="perf-tpot-value"
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
                {formatTokenRate(metrics.total_tokens_per_second)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t pt-2.5 text-xs">
              <SmallStat
                label={t("endpoints.performance.promptTokensPerSecond")}
                value={formatTokenRate(metrics.prompt_tokens_per_second)}
                testId="perf-prompt-tps-value"
              />
              <SmallStat
                label={t("endpoints.performance.generationTokensPerSecond")}
                value={formatTokenRate(metrics.generation_tokens_per_second)}
                testId="perf-gen-tps-value"
              />
            </div>
          </div>
        </MetricTile>

        <MetricTile
          icon={Database}
          title={t("endpoints.performance.kvCache")}
          cumulative={
            metrics.hit_rate_cumulative && (
              <CumulativeBadge testId="perf-cache-cumulative" />
            )
          }
        >
          <div className="mt-3 space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <HitRate
                label={t("endpoints.performance.l0HitRate")}
                ratio={metrics.l0_hit_rate}
                series="green"
                testId="perf-l0-hit-rate"
              />
              <HitRate
                label={t("endpoints.performance.l1HitRate")}
                ratio={metrics.l1_hit_rate}
                series="blue"
                testId="perf-l1-hit-rate"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t pt-2.5 text-xs">
              <SmallStat
                label={t("endpoints.performance.l1ReadSpeed")}
                value={formatBandwidth(metrics.l1_read_bytes_per_second)}
                testId="perf-l1-read-speed"
              />
              <SmallStat
                label={t("endpoints.performance.l1WriteSpeed")}
                value={formatBandwidth(metrics.l1_write_bytes_per_second)}
                testId="perf-l1-write-speed"
              />
            </div>
          </div>
        </MetricTile>
      </div>
    </Section>
  );
}

function MetricTile({
  icon: Icon,
  title,
  cumulative,
  children,
}: {
  icon: LucideIcon;
  title: string;
  cumulative?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        {cumulative}
      </div>
      {children}
    </div>
  );
}

function CumulativeBadge({ testId }: { testId: string }) {
  const { t } = useTranslation();
  return (
    <span
      data-testid={testId}
      className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
    >
      {t("endpoints.performance.cumulative")}
    </span>
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
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div
        data-testid={testId}
        className="mt-1 text-xl font-semibold tabular-nums text-foreground"
      >
        {formatLatency(p95 ?? avg)}
      </div>
      <div className="mt-1 text-xs tabular-nums text-muted-foreground">
        {t("endpoints.performance.p95")} {formatLatency(p95)} ·{" "}
        {t("endpoints.performance.avg")} {formatLatency(avg)}
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

function HitRate({
  label,
  ratio,
  series,
  testId,
}: {
  label: string;
  ratio?: number;
  series: "green" | "blue";
  testId: string;
}) {
  const measured = ratio != null;
  return (
    <div>
      <div className="flex items-center justify-between gap-1 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span
          data-testid={testId}
          className="font-semibold tabular-nums text-foreground"
        >
          {formatPercent(ratio)}
        </span>
      </div>
      <MetricBar
        className="mt-1.5"
        size="sm"
        series={series}
        value={measured ? ratio * 100 : null}
        track={measured ? "subtle" : "unavailable"}
      />
    </div>
  );
}
