import { useCustom } from "@refinedev/core";
import { observationStatus } from "@/foundation/lib/accelerator-observations";

export type PerformanceWindow = "5m" | "1h" | "24h";

export type PerformanceTimeRange =
  | { kind: "preset"; window: PerformanceWindow }
  | { kind: "custom"; start: number; end: number };

export type PerformanceTrendMetric =
  | "ttft_p95_seconds"
  | "ttft_avg_seconds"
  | "tpot_p95_seconds"
  | "tpot_avg_seconds"
  | "prompt_tokens_per_second"
  | "generation_tokens_per_second"
  | "total_tokens_per_second"
  | "l0_hit_rate"
  | "l1_hit_rate"
  | "l1_read_bytes_per_second"
  | "l1_write_bytes_per_second";

export type PerformanceTrendUnit =
  | "seconds"
  | "tokens_per_second"
  | "ratio"
  | "bytes_per_second";

export type PerformanceTrendPoint = {
  timestamp: number;
  value: number;
};

export type PerformanceTrendSeries = {
  metric: PerformanceTrendMetric;
  unit: PerformanceTrendUnit;
  points: PerformanceTrendPoint[];
};

type EndpointPerformanceTrends = {
  status: "ok" | "no_data" | "not_configured";
  window: PerformanceWindow | "custom";
  start: number;
  end: number;
  step_seconds: number;
  series: PerformanceTrendSeries[];
};

export function useEndpointPerformanceTrends(
  workspace?: string | null,
  name?: string | null,
  range: PerformanceTimeRange = { kind: "preset", window: "5m" },
  autoRefresh = true,
) {
  const query = useCustom<EndpointPerformanceTrends>({
    url: `/endpoints/${encodeURIComponent(workspace ?? "")}/${encodeURIComponent(name ?? "")}/performance-trends?${new URLSearchParams(
      range.kind === "preset"
        ? { window: range.window }
        : { start: String(range.start), end: String(range.end) },
    ).toString()}`,
    method: "get",
    queryOptions: {
      enabled: Boolean(workspace && name),
      // Custom ranges and paused endpoints have no live updates to poll for.
      refetchInterval: autoRefresh && range.kind === "preset" ? 15000 : false,
      retry: false,
    },
  });

  const data = query.error ? undefined : query.data?.data;
  const series = data?.series ?? [];

  return {
    series,
    status: observationStatus(
      Boolean(query.error),
      query.isLoading,
      data?.status,
      series.some((item) => item.points.length > 0),
    ),
  };
}
