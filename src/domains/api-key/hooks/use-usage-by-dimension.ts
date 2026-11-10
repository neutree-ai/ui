import type { ApiUsageRecord } from "@/domains/api-key/types";
import { useUsageRpcBatch } from "./use-usage-rpc";

// useUsageByDimension polls the get_usage_by_dimension RPC; see
// useUsageRpcBatch. Null params fetch nothing.
export function useUsageByDimension(
  params: Record<string, unknown> | null,
  enabled = true,
) {
  return useUsageRpcBatch<ApiUsageRecord>(
    "/rpc/get_usage_by_dimension",
    params ? [params] : [],
    enabled && !!params,
  );
}
