import { useMemo } from "react";
import { useUsageByDimension } from "./use-usage-by-dimension";

// useWorkspaceUsage returns a whole workspace's per-day, per-API-key, per-model
// token usage (scoped to the caller's own API keys by the RPC's auth.uid()
// filter). Same RPC as useApiKeyUsage, keyed by workspace + date range.
export function useWorkspaceUsage(
  workspace: string | undefined,
  startDate: string,
  endDate: string,
) {
  const params = useMemo(
    () =>
      workspace
        ? {
            p_start_date: startDate,
            p_end_date: endDate,
            p_workspace: workspace,
          }
        : null,
    [workspace, startDate, endDate],
  );
  return useUsageByDimension(params);
}
