import { useMemo } from "react";
import type { ApiUsageRecord } from "@/domains/api-key/types";
import { useUsageRpcBatch } from "./use-usage-rpc";

export { POLL_INTERVAL_MS } from "./use-usage-rpc";

// useUsageByDimension polls the get_usage_by_dimension RPC; see
// useUsageRpcBatch. `params` MUST be memoized, as there.
export function useUsageByDimension(params: Record<string, unknown> | null) {
  const paramsList = useMemo(() => (params ? [params] : null), [params]);
  return useUsageRpcBatch<ApiUsageRecord>(
    "/rpc/get_usage_by_dimension",
    paramsList,
  );
}
