import { useMemo } from "react";
import { useUsageByDimension } from "./use-usage-by-dimension";

// useApiKeyUsage returns one API key's per-day, per-dimension token usage.
// The end bound is a fixed far-future date rather than "now": the 60s poll repeats
// the same params, so a mount-time `new Date()` would freeze the upper bound and stop
// reflecting usage accruing later today. A far-future bound keeps params stable while
// always covering "up to now".
export function useApiKeyUsage(apiKeyId: string | number | undefined) {
  const params = useMemo(
    () =>
      apiKeyId
        ? {
            p_start_date: "2025-01-01",
            p_end_date: "2100-01-01",
            p_api_key_id: apiKeyId,
          }
        : null,
    [apiKeyId],
  );
  return useUsageByDimension(params);
}
