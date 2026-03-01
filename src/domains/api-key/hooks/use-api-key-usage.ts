import type { ApiUsageRecord } from "@/domains/api-key/types";
import { useCustomMutation } from "@refinedev/core";
import { useCallback, useEffect, useState } from "react";

export const POLL_INTERVAL_MS = 60_000;

export function useApiKeyUsage(apiKeyId: string | number | undefined) {
  const [usageData, setUsageData] = useState<ApiUsageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { mutateAsync } = useCustomMutation();

  const fetchUsageData = useCallback(async () => {
    if (!apiKeyId) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await mutateAsync({
        url: "/rpc/get_usage_by_dimension",
        method: "post",
        values: {
          p_start_date: "2025-01-01",
          p_end_date: new Date().toISOString(),
          p_api_key_id: apiKeyId,
        },
      });
      setUsageData(res.data as ApiUsageRecord[]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [apiKeyId, mutateAsync]);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  useEffect(() => {
    const interval = setInterval(fetchUsageData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchUsageData]);

  return { usageData, isLoading, error };
}
