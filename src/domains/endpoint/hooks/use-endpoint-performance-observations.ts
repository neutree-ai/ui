import { useCustom } from "@refinedev/core";
import { observationStatus } from "@/foundation/lib/accelerator-observations";

export type PerformanceWindow = "5m" | "1h" | "24h";

type EndpointPerformanceMetrics = {
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
    url: `/endpoints/${encodeURIComponent(workspace ?? "")}/${encodeURIComponent(name ?? "")}/performance-observations?window=${window}`,
    method: "get",
    queryOptions: {
      enabled: Boolean(workspace && name && enabled),
      refetchInterval: 15000,
      retry: false,
    },
  });

  // A disabled query keeps its last cached result; it is not shown.
  if (!enabled) return { metrics: {}, status: "no_data" as const };
  const data = query.error ? undefined : query.data?.data;
  const metrics: EndpointPerformanceMetrics = data?.metrics ?? {};
  return {
    metrics,
    status: observationStatus(
      Boolean(query.error),
      query.isLoading,
      data?.status,
      Object.values(metrics).some((v) => typeof v === "number"),
    ),
  };
}
