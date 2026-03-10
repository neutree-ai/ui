import { useCustomMutation } from "@refinedev/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ExternalEndpointUsageRow = {
  date: string;
  api_key_name: string;
  model_name: string | null;
  usage: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
};

type ExternalEndpointUsageSummary = {
  totalRequests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

const POLL_INTERVAL_MS = 60_000;

function getStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function useExternalEndpointUsage(
  endpointName: string | undefined,
  workspace: string | undefined,
) {
  const [rows, setRows] = useState<ExternalEndpointUsageRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { mutateAsync } = useCustomMutation();
  const mutateRef = useRef(mutateAsync);
  mutateRef.current = mutateAsync;

  const summary = useMemo<ExternalEndpointUsageSummary>(
    () =>
      rows.reduce(
        (acc, row) => ({
          totalRequests: acc.totalRequests + (row.usage ?? 0),
          promptTokens: acc.promptTokens + (row.prompt_tokens ?? 0),
          completionTokens: acc.completionTokens + (row.completion_tokens ?? 0),
          totalTokens:
            acc.totalTokens +
            (row.prompt_tokens ?? 0) +
            (row.completion_tokens ?? 0),
        }),
        {
          totalRequests: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      ),
    [rows],
  );

  const fetchUsage = useCallback(async () => {
    if (!endpointName || !workspace) return;

    setIsLoading(true);
    try {
      const res = await mutateRef.current({
        url: "/rpc/get_usage_by_dimension",
        method: "post",
        values: {
          p_start_date: getStartDate(),
          p_end_date: new Date().toISOString(),
          p_endpoint_name: endpointName,
          p_workspace: workspace,
        },
        successNotification: false,
        errorNotification: false,
      });

      setRows(res.data as ExternalEndpointUsageRow[]);
    } catch {
      // Non-critical — monitor panel degrades gracefully
    } finally {
      setIsLoading(false);
    }
  }, [endpointName, workspace]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  useEffect(() => {
    if (!endpointName || !workspace) return;
    const interval = setInterval(fetchUsage, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchUsage, endpointName, workspace]);

  return { rows, summary, isLoading };
}
