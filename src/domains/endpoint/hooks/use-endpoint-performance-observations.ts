import { useCustom } from "@refinedev/core";

export type PerformanceWindow = "5m" | "1h" | "24h";

export type EndpointPerformanceMetrics = {
  ttft_p95_seconds?: number;
  ttft_avg_seconds?: number;
  tpot_p95_seconds?: number;
  tpot_avg_seconds?: number;
  latency_cumulative?: boolean;
  prompt_tokens_per_second?: number;
  generation_tokens_per_second?: number;
  total_tokens_per_second?: number;
  requests_per_second?: number;
  l0_hit_rate?: number;
  l1_hit_rate?: number;
  hit_rate_cumulative?: boolean;
  l1_read_bytes_per_second?: number;
  l1_write_bytes_per_second?: number;
};

type EndpointPerformanceSnapshot = {
  status: "ok" | "no_data" | "not_configured";
  window: PerformanceWindow;
  metrics: EndpointPerformanceMetrics;
};

export function useEndpointPerformanceObservations(
  workspace?: string | null,
  name?: string | null,
  window: PerformanceWindow = "5m",
  enabled = true,
) {
  const query = useCustom<EndpointPerformanceSnapshot>({
    url: `/endpoints/${encodeURIComponent(workspace ?? "")}/${encodeURIComponent(name ?? "")}/performance-observations?window=${encodeURIComponent(window)}`,
    method: "get",
    queryOptions: {
      enabled: Boolean(workspace && name && enabled),
      refetchInterval: 15000,
      retry: false,
    },
  });

  const data = query.error ? undefined : query.data?.data;
  const metrics = data?.metrics ?? {};
  const hasAnyMetric = Object.values(metrics).some(
    (v) => typeof v === "number",
  );

  return {
    metrics,
    status: query.error
      ? "unavailable"
      : query.isLoading
        ? "loading"
        : data?.status === "not_configured"
          ? "not_configured"
          : hasAnyMetric
            ? "ok"
            : "no_data",
  };
}
