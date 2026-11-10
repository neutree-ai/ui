import { useCustomMutation } from "@refinedev/core";
import { useQueries } from "@tanstack/react-query";
import { useRef } from "react";

export const POLL_INTERVAL_MS = 60_000;

const NO_ROWS: never[] = [];

// The rows of every page together. They keep their identity until a page
// changes, so callers can memo on them.
function useFlatPages<T>(pages: (T[] | undefined)[]): T[] {
  const last = useRef<{ pages: (T[] | undefined)[]; rows: T[] }>({
    pages: [],
    rows: NO_ROWS,
  });
  const prev = last.current.pages;
  if (pages.length !== prev.length || pages.some((p, i) => p !== prev[i])) {
    last.current = {
      pages,
      rows: pages.some(Boolean) ? pages.flatMap((p) => p ?? []) : NO_ROWS,
    };
  }
  return last.current.rows;
}

// useUsageRpcBatch polls a usage RPC once per params object and returns the
// rows of all calls together. Each call is cached by its url and params, and
// refetched every POLL_INTERVAL_MS while the page is visible. A disabled batch
// keeps its cache; an empty list fetches nothing and yields no rows.
// While new params load, the previous rows stay and `isPlaceholder` is set:
// they are no answer to the current params yet.
export function useUsageRpcBatch<T>(
  url: string,
  paramsList: Record<string, unknown>[],
  enabled: boolean,
) {
  // refine's custom POST, with its auth check and error notification.
  const { mutateAsync } = useCustomMutation();
  const results = useQueries({
    queries: paramsList.map((values) => ({
      queryKey: [url, values],
      queryFn: async () =>
        (await mutateAsync({ url, method: "post", values })).data as T[],
      enabled,
      staleTime: POLL_INTERVAL_MS,
      refetchInterval: POLL_INTERVAL_MS,
      refetchIntervalInBackground: false,
      // Catch up when the page is shown again.
      refetchOnWindowFocus: true,
      keepPreviousData: true,
      retry: false,
    })),
  });

  const failed = results.find((r) => r.error)?.error;
  const error = failed
    ? failed instanceof Error
      ? failed
      : new Error(String(failed))
    : null;
  // A failed refresh/poll must not leave stale usage on screen masquerading
  // as the current result.
  const usageData = useFlatPages(failed ? [] : results.map((r) => r.data));

  return {
    usageData,
    isLoading: results.some((r) => r.isFetching),
    isPlaceholder:
      enabled &&
      results.some(
        (r) => r.isPreviousData || (r.isFetching && r.data === undefined),
      ),
    error,
    refetch: async () => {
      if (enabled) await Promise.all(results.map((r) => r.refetch()));
    },
  };
}
