import { useCustomMutation } from "@refinedev/core";
import { useCallback, useEffect, useState } from "react";
import type { ApiUsageRecord } from "@/domains/api-key/types";

const POLL_INTERVAL_MS = 60_000;

// useUsageByDimension polls the get_usage_by_dimension RPC and returns the rows.
// Pass null to disable fetching (before a required id/workspace is known).
// `params` MUST be a stable (memoized) reference — it keys both the fetch and
// the 60s poll, so an unmemoized object would refetch on every render.
export function useUsageByDimension(params: Record<string, unknown> | null) {
  const [usageData, setUsageData] = useState<ApiUsageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { mutateAsync } = useCustomMutation();

  const fetchUsageData = useCallback(async () => {
    if (!params) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await mutateAsync({
        url: "/rpc/get_usage_by_dimension",
        method: "post",
        values: params,
      });
      setUsageData(res.data as ApiUsageRecord[]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [params, mutateAsync]);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  useEffect(() => {
    const interval = setInterval(fetchUsageData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchUsageData]);

  return { usageData, isLoading, error, refetch: fetchUsageData };
}
