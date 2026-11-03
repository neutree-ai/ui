import { Activity, Clock, Database } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type EndpointPerformanceMetrics,
  type PerformanceWindow,
  useEndpointPerformanceObservations,
} from "@/domains/endpoint/hooks/use-endpoint-performance-observations";
import { ObservationStatus } from "@/foundation/components/GpuObservationCard";
import { MetricBar } from "@/foundation/components/MetricBar";
import { Section } from "@/foundation/components/Section";
import { SegmentedControl } from "@/foundation/components/SegmentedControl";

function formatLatency(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds === 0) return "0 ms";
  if (seconds < 1) {
    const ms = seconds * 1000;
    return `${ms < 10 ? ms.toFixed(1) : ms.toFixed(0)} ms`;
  }
  return `${seconds.toFixed(2)} s`;
}

function formatTokenRate(tokensPerSec?: number | null): string {
  if (
    tokensPerSec == null ||
    !Number.isFinite(tokensPerSec) ||
    tokensPerSec < 0
  ) {
    return "—";
  }
  if (tokensPerSec === 0) return "0 tok/s";
  return `${tokensPerSec >= 100 ? tokensPerSec.toFixed(1) : tokensPerSec.toFixed(2).replace(/\.?0+$/, "")} tok/s`;
}

function formatPercent(ratio?: number | null): string {
  if (ratio == null || !Number.isFinite(ratio) || ratio < 0) return "—";
  const clamped = Math.max(0, Math.min(1, ratio));
  return `${(clamped * 100).toFixed(1)}%`;
}

function formatBandwidth(bytesPerSec?: number | null): string {
  if (bytesPerSec == null || !Number.isFinite(bytesPerSec) || bytesPerSec < 0) {
    return "—";
  }
  if (bytesPerSec === 0) return "0 B/s";
  if (bytesPerSec >= 1024 ** 3) {
    return `${(bytesPerSec / 1024 ** 3).toFixed(2)} GiB/s`;
  }
  if (bytesPerSec >= 1024 ** 2) {
    return `${(bytesPerSec / 1024 ** 2).toFixed(1)} MiB/s`;
  }
  if (bytesPerSec >= 1024) {
    return `${(bytesPerSec / 1024).toFixed(1)} KiB/s`;
  }
  return `${bytesPerSec.toFixed(0)} B/s`;
}

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
  const { metrics: rawMetrics, status } = useEndpointPerformanceObservations(
    workspace,
    name,
    window,
    !paused,
  );
  const metrics: EndpointPerformanceMetrics = paused ? {} : rawMetrics;

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
      <ObservationStatus status={paused ? "no_data" : status} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col justify-between rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {t("endpoints.performance.latency")}
              </span>
            </div>
            {metrics.latency_cumulative && (
              <span
                data-testid="perf-latency-cumulative"
                className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {t("endpoints.performance.cumulative")}
              </span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                {t("endpoints.performance.ttft")}
              </div>
              <div
                data-testid="perf-ttft-value"
                className="mt-1 text-xl font-semibold tabular-nums text-foreground"
              >
                {formatLatency(
                  metrics.ttft_p95_seconds ?? metrics.ttft_avg_seconds,
                )}
              </div>
              <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                {t("endpoints.performance.p95")}{" "}
                {formatLatency(metrics.ttft_p95_seconds)} ·{" "}
                {t("endpoints.performance.avg")}{" "}
                {formatLatency(metrics.ttft_avg_seconds)}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                {t("endpoints.performance.tpot")}
              </div>
              <div
                data-testid="perf-tpot-value"
                className="mt-1 text-xl font-semibold tabular-nums text-foreground"
              >
                {formatLatency(
                  metrics.tpot_p95_seconds ?? metrics.tpot_avg_seconds,
                )}
              </div>
              <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                {t("endpoints.performance.p95")}{" "}
                {formatLatency(metrics.tpot_p95_seconds)} ·{" "}
                {t("endpoints.performance.avg")}{" "}
                {formatLatency(metrics.tpot_avg_seconds)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {t("endpoints.performance.throughput")}
            </span>
          </div>
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
              <div>
                <div className="text-muted-foreground">
                  {t("endpoints.performance.promptTokensPerSecond")}
                </div>
                <div
                  data-testid="perf-prompt-tps-value"
                  className="mt-0.5 font-semibold tabular-nums text-foreground"
                >
                  {formatTokenRate(metrics.prompt_tokens_per_second)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">
                  {t("endpoints.performance.generationTokensPerSecond")}
                </div>
                <div
                  data-testid="perf-gen-tps-value"
                  className="mt-0.5 font-semibold tabular-nums text-foreground"
                >
                  {formatTokenRate(metrics.generation_tokens_per_second)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {t("endpoints.performance.kvCache")}
              </span>
            </div>
            {metrics.hit_rate_cumulative && (
              <span
                data-testid="perf-cache-cumulative"
                className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {t("endpoints.performance.cumulative")}
              </span>
            )}
          </div>
          <div className="mt-3 space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between gap-1 text-xs">
                  <span className="text-muted-foreground">
                    {t("endpoints.performance.l0HitRate")}
                  </span>
                  <span
                    data-testid="perf-l0-hit-rate"
                    className="font-semibold tabular-nums text-foreground"
                  >
                    {formatPercent(metrics.l0_hit_rate)}
                  </span>
                </div>
                <MetricBar
                  className="mt-1.5"
                  size="sm"
                  series="green"
                  value={
                    metrics.l0_hit_rate != null
                      ? metrics.l0_hit_rate * 100
                      : null
                  }
                  track={metrics.l0_hit_rate != null ? "subtle" : "unavailable"}
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-1 text-xs">
                  <span className="text-muted-foreground">
                    {t("endpoints.performance.l1HitRate")}
                  </span>
                  <span
                    data-testid="perf-l1-hit-rate"
                    className="font-semibold tabular-nums text-foreground"
                  >
                    {formatPercent(metrics.l1_hit_rate)}
                  </span>
                </div>
                <MetricBar
                  className="mt-1.5"
                  size="sm"
                  series="blue"
                  value={
                    metrics.l1_hit_rate != null
                      ? metrics.l1_hit_rate * 100
                      : null
                  }
                  track={metrics.l1_hit_rate != null ? "subtle" : "unavailable"}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t pt-2.5 text-xs">
              <div>
                <div className="text-muted-foreground">
                  {t("endpoints.performance.l1ReadSpeed")}
                </div>
                <div
                  data-testid="perf-l1-read-speed"
                  className="mt-0.5 font-semibold tabular-nums text-foreground"
                >
                  {formatBandwidth(metrics.l1_read_bytes_per_second)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">
                  {t("endpoints.performance.l1WriteSpeed")}
                </div>
                <div
                  data-testid="perf-l1-write-speed"
                  className="mt-0.5 font-semibold tabular-nums text-foreground"
                >
                  {formatBandwidth(metrics.l1_write_bytes_per_second)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
