import { useMemo } from "react";
import { useUsageByDimension } from "./use-usage-by-dimension";

export { POLL_INTERVAL_MS } from "./use-usage-by-dimension";

// useApiKeyUsage returns one API key's per-day, per-dimension token usage.
export function useApiKeyUsage(apiKeyId: string | number | undefined) {
  const params = useMemo(
    () =>
      apiKeyId
        ? {
            p_start_date: "2025-01-01",
            p_end_date: new Date().toISOString(),
            p_api_key_id: apiKeyId,
          }
        : null,
    [apiKeyId],
  );
  return useUsageByDimension(params);
}
