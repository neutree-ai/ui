import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { clientPostgrest, REST_URL } from "@/foundation/lib/api";
import { auth } from "@/foundation/providers/auth-provider";

const AUTO_REFRESH_INTERVAL = 10000;

export const useStreamingLogs = (url: string | null, enabled = true) => {
  const { t } = useTranslation();
  const sourceUrl = enabled && url ? url : null;
  const [state, setState] = useState<{
    url: string | null;
    logs: string;
    isLoading: boolean;
    error: string | null;
  }>({ url: null, logs: "", isLoading: false, error: null });
  const [revision, setRevision] = useState(0);
  const request = useMemo(
    () => ({ url: sourceUrl, revision }),
    [sourceUrl, revision],
  );
  const loadedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const source = request.url;
    if (loadedUrlRef.current !== source) loadedUrlRef.current = null;
    if (!source) {
      setState({ url: null, logs: "", isLoading: false, error: null });
      return;
    }

    let disposed = false;
    let fetching = false;
    let controller: AbortController | null = null;
    let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    async function fetchLogs() {
      if (disposed || fetching) return;
      fetching = true;
      const requestController = new AbortController();
      controller = requestController;
      const isCurrent = () => !disposed && !requestController.signal.aborted;
      const silent = loadedUrlRef.current === source;
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

      setState((previous) => ({
        url: source,
        logs: silent && previous.url === source ? previous.logs : "",
        isLoading: !silent,
        error: null,
      }));

      try {
        const {
          data: { session },
        } = await auth.getSession();
        if (!isCurrent()) return;

        const headers: HeadersInit = { ...clientPostgrest.headers };
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        const response = await fetch(`${REST_URL}${source}`, {
          signal: requestController.signal,
          headers,
        });
        if (!isCurrent()) {
          await response.body?.cancel();
          return;
        }
        if (!response.ok) {
          throw new Error(
            t("endpoints.logs.httpError", { status: response.status }),
          );
        }

        reader = response.body?.getReader();
        if (!reader) throw new Error(t("endpoints.logs.unreadableResponse"));
        activeReader = reader;
        const decoder = new TextDecoder();
        let accumulatedLogs = "";

        while (isCurrent()) {
          const { done, value } = await reader.read();
          if (!isCurrent()) return;
          if (done) break;
          accumulatedLogs += decoder.decode(value, { stream: true });
          if (!silent) {
            setState({
              url: source,
              logs: accumulatedLogs,
              isLoading: true,
              error: null,
            });
          }
        }

        if (!isCurrent()) return;
        accumulatedLogs += decoder.decode();
        loadedUrlRef.current = source;
        setState({
          url: source,
          logs: accumulatedLogs,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (
          isCurrent() &&
          !(error instanceof Error && error.name === "AbortError")
        ) {
          setState((previous) => ({
            url: source,
            logs: previous.url === source ? previous.logs : "",
            isLoading: false,
            error:
              error instanceof Error
                ? error.message
                : t("endpoints.logs.unknownError"),
          }));
        }
      } finally {
        reader?.releaseLock();
        activeReader = null;
        if (isCurrent()) {
          fetching = false;
          setState((previous) => ({ ...previous, isLoading: false }));
        }
      }
    }

    void fetchLogs();
    const interval = setInterval(() => {
      void fetchLogs();
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      disposed = true;
      clearInterval(interval);
      controller?.abort();
      void activeReader?.cancel().catch(() => undefined);
    };
  }, [request, t]);

  const current = sourceUrl !== null && state.url === sourceUrl;
  return {
    logs: current ? state.logs : "",
    isLoading: sourceUrl !== null && (!current || state.isLoading),
    error: current ? state.error : null,
    refetch: () => setRevision((previous) => previous + 1),
  };
};
