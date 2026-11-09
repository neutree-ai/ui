import { useCustomMutation } from "@refinedev/core";
import { useCallback, useEffect, useRef, useState } from "react";

export const POLL_INTERVAL_MS = 60_000;

// useUsageRpcBatch polls a usage RPC once per params object and returns the
// rows of all calls together. Pass null to disable fetching (before a required
// id/workspace is known); an empty list fetches nothing and yields no rows.
// `paramsList` MUST be a stable (memoized) reference — it keys both the fetch
// and the 60s poll, so an unmemoized array would refetch on every render.
// The poll skips a hidden page and catches up when it is shown again.
export function useUsageRpcBatch<T>(
  url: string,
  paramsList: Record<string, unknown>[] | null,
) {
  const [usageData, setUsageData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { mutateAsync } = useCustomMutation();
  // Only the latest request may write: a slow answer for the previous params
  // must not land over the current one.
  const latest = useRef(0);

  const fetchUsageData = useCallback(async () => {
    if (!paramsList) return;

    const request = ++latest.current;
    setIsLoading(true);
    setError(null);
    try {
      const pages = await Promise.all(
        paramsList.map((values) =>
          mutateAsync({ url, method: "post", values }),
        ),
      );
      if (request !== latest.current) return;
      setUsageData(pages.flatMap((res) => res.data as T[]));
    } catch (err) {
      if (request !== latest.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
      // Drop the previous rows on failure: a failed refresh/poll must not leave
      // stale usage on screen masquerading as the current result.
      setUsageData([]);
    } finally {
      if (request === latest.current) setIsLoading(false);
    }
  }, [url, paramsList, mutateAsync]);

  useEffect(() => {
    // New params: the rows of the old ones are no answer to them, and a
    // caller that combines rows of several hooks would add them up wrong.
    setUsageData([]);
    fetchUsageData();
  }, [fetchUsageData]);

  useEffect(() => {
    const visible = () => document.visibilityState !== "hidden";
    const interval = setInterval(() => {
      if (visible()) fetchUsageData();
    }, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (visible()) fetchUsageData();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchUsageData]);

  return { usageData, isLoading, error, refetch: fetchUsageData };
}
