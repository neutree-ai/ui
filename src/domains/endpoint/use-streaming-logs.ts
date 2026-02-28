import { REST_URL, clientPostgrest } from "@/foundation/lib/api";
import { auth } from "@/foundation/providers/auth-provider";
import { useEffect, useRef, useState } from "react";

const AUTO_REFRESH_INTERVAL = 10000;

/**
 * Custom hook for streaming log content from an endpoint
 *
 * This hook fetches logs using the ReadableStream API for efficient
 * streaming of log content without loading everything into memory at once.
 * It automatically includes authentication headers from the current session.
 *
 * @param url - The log URL to fetch from (relative path, will be prefixed with REST_URL)
 * @param enabled - Whether to start fetching (default: true)
 * @returns Object containing log content, loading state, error, and refetch function
 *
 * @example
 * ```tsx
 * const { logs, isLoading, error, refetch } = useStreamingLogs(
 *   '/endpoints/workspace/endpoint/logs/replica-id/logs?lines=1000',
 *   true
 * );
 *
 * if (isLoading) return <div>Loading logs...</div>;
 * if (error) return <div>Error: {error}</div>;
 * return <pre>{logs}</pre>;
 * ```
 */
export const useStreamingLogs = (url: string | null, enabled = true) => {
  const [logs, setLogs] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    // Skip if not enabled or no URL
    if (!enabled || !url) {
      return;
    }

    async function fetchLogs() {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      setIsLoading(true);
      setError(null);

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      try {
        // Get current session for authentication
        const {
          data: { session },
        } = await auth.getSession();

        // Construct full URL with base URL
        const fullUrl = `${REST_URL}${url}`;

        // Prepare headers with authentication
        const headers: HeadersInit = {
          ...clientPostgrest.headers,
        };

        // Add authorization header if session exists
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        const response = await fetch(fullUrl, {
          signal: abortControllerRef.current.signal,
          headers,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not readable");
        }

        const decoder = new TextDecoder();
        let accumulatedLogs = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedLogs += chunk;
          setLogs(accumulatedLogs);
        }
      } catch (err) {
        if (err instanceof Error) {
          if (err.name !== "AbortError") {
            console.error("Failed to fetch logs:", err);
            setError(err.message);
          }
        } else {
          console.error("Failed to fetch logs:", err);
          setError("Unknown error occurred");
        }
      } finally {
        isFetchingRef.current = false;
        setIsLoading(false);
      }
    }

    fetchLogs();

    // Auto-refresh every 10 seconds
    intervalRef.current = setInterval(() => {
      fetchLogs();
    }, AUTO_REFRESH_INTERVAL);

    // Cleanup: abort the request and clear interval
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [url, enabled, refetchTrigger]);

  const refetch = () => {
    setRefetchTrigger((prev) => prev + 1);
  };

  return {
    logs,
    isLoading,
    error,
    refetch,
  };
};
