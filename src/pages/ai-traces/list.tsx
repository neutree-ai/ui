import { useList, useParsed } from "@refinedev/core";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type DateRange,
  DateRangePicker,
  trailingRange,
} from "@/foundation/components/DateRangePicker";
import { ListPage } from "@/foundation/components/ListPage";
import { Loader } from "@/foundation/components/Loader";
import Timestamp from "@/foundation/components/Timestamp";
import { ALL_WORKSPACES } from "@/foundation/hooks/use-workspace";
import { type AITrace, fetchAITraces } from "@/foundation/lib/api/ai-traces";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatTokens } from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";
import { TraceDetailDrawer } from "./components/TraceDetailDrawer";
import { TraceStatsChart } from "./components/TraceStatsChart";

const LIMIT = 50;

export const AITracesList = () => {
  const { t } = useTranslation();
  const { params } = useParsed();
  const workspace = (params?.workspace as string) ?? "";
  // "All workspaces" aggregates traces across workspaces, so show a workspace
  // column to disambiguate rows (it is redundant on a single-workspace view).
  const isAllWorkspaces = workspace === ALL_WORKSPACES;
  const colSpan = isAllWorkspaces ? 11 : 10;

  const [endpointName, setEndpointName] = useState("");
  const [endpointType, setEndpointType] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [model, setModel] = useState("");
  // Pre-fill the api-key filter from ?api_key_id=… so the API-key detail page's
  // "view call logs" link lands here scoped to that key.
  const [apiKeyId, setApiKeyId] = useState<string>(
    () => (params?.api_key_id as string) ?? "",
  );
  const [finishReason, setFinishReason] = useState<string>("");
  const [range, setRange] = useState<DateRange>(() => trailingRange(7));
  const [selected, setSelected] = useState<AITrace | null>(null);

  // Workspace's API keys — for both the filter dropdown and id→name resolution
  // in the table cell.
  const { data: keysData } = useList<{
    id: string;
    metadata?: { name?: string };
  }>({
    resource: "api_keys",
    pagination: { mode: "off" },
    meta: { workspace },
    queryOptions: { enabled: Boolean(workspace) },
  });
  const keys = keysData?.data ?? [];
  const keyName = (id?: string) => {
    if (!id) return "";
    return keys.find((k) => k.id === id)?.metadata?.name ?? "";
  };

  const queryArgs = {
    workspace,
    endpoint_name: endpointName.trim() || undefined,
    endpoint_type: endpointType || undefined,
    status: status || undefined,
    model: model.trim() || undefined,
    api_key_id: apiKeyId || undefined,
    finish_reason: finishReason || undefined,
    // Date-range filter → inclusive [start-of-day, end-of-day] timestamps.
    start: dayjs(range.start).startOf("day").toISOString(),
    end: dayjs(range.end).endOf("day").toISOString(),
    limit: LIMIT,
  };

  const queryClient = useQueryClient();
  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["ai-traces", queryArgs],
    queryFn: ({ pageParam, signal }) =>
      fetchAITraces(
        { ...queryArgs, before: pageParam as string | undefined },
        signal,
      ),
    // The list endpoint returns `next_before` (the last row's timestamp) as the
    // cursor for the next, strictly-older page; empty means no more records.
    getNextPageParam: (lastPage) => lastPage.next_before || undefined,
    enabled: Boolean(workspace),
  });

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["ai-trace-stats"] });
  };

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  // Infinite scroll: load the next page when the sentinel near the bottom of
  // the list scrolls into view.
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <ListPage
      title={t("ai_traces.title")}
      canCreate={false}
      breadcrumb={false}
      extra={
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isFetching}
        >
          <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
          {t("ai_traces.refresh")}
        </Button>
      }
    >
      <TraceStatsChart workspace={workspace} />

      <div className="flex flex-wrap gap-2 mb-4">
        <DateRangePicker value={range} onChange={setRange} />
        <Input
          className="w-[200px]"
          placeholder={t("ai_traces.filters.endpoint")}
          value={endpointName}
          onChange={(e) => setEndpointName(e.target.value)}
        />
        <Select
          value={endpointType || "all"}
          onValueChange={(v) => setEndpointType(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("ai_traces.filters.endpointType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("ai_traces.filters.allTypes")}
            </SelectItem>
            <SelectItem value="endpoint">endpoint</SelectItem>
            <SelectItem value="external-endpoint">external-endpoint</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status || "all"}
          onValueChange={(v) => setStatus(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t("ai_traces.filters.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("ai_traces.filters.allStatuses")}
            </SelectItem>
            <SelectItem value="200">200</SelectItem>
            <SelectItem value="400">400</SelectItem>
            <SelectItem value="401">401</SelectItem>
            <SelectItem value="429">429</SelectItem>
            <SelectItem value="500">500</SelectItem>
            <SelectItem value="502">502</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="w-[200px]"
          placeholder={t("ai_traces.filters.model")}
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
        <Select
          value={apiKeyId || "all"}
          onValueChange={(v) => setApiKeyId(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("ai_traces.filters.apiKey")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("ai_traces.filters.allApiKeys")}
            </SelectItem>
            {keys.map((k) => (
              <SelectItem key={k.id} value={k.id}>
                {k.metadata?.name ?? k.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={finishReason || "all"}
          onValueChange={(v) => setFinishReason(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("ai_traces.filters.finishReason")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("ai_traces.filters.allFinishReasons")}
            </SelectItem>
            <SelectItem value="stop">stop</SelectItem>
            <SelectItem value="length">length</SelectItem>
            <SelectItem value="tool_calls">tool_calls</SelectItem>
            <SelectItem value="content_filter">content_filter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="text-sm text-destructive mb-2">
          {(error as Error).message}
        </div>
      ) : null}

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">
                {t("ai_traces.columns.time")}
              </TableHead>
              {isAllWorkspaces && (
                <TableHead className="w-[140px]">
                  {t("ai_traces.columns.workspace")}
                </TableHead>
              )}
              <TableHead>{t("ai_traces.columns.endpoint")}</TableHead>
              <TableHead className="w-[120px]">
                {t("ai_traces.columns.app")}
              </TableHead>
              <TableHead>{t("ai_traces.columns.model")}</TableHead>
              <TableHead className="w-[90px]">
                {t("ai_traces.columns.status")}
              </TableHead>
              <TableHead className="w-[140px]">
                {t("ai_traces.columns.apiKey")}
              </TableHead>
              <TableHead className="w-[90px] text-right">
                {t("ai_traces.columns.tokens")}
              </TableHead>
              <TableHead className="w-[90px] text-right">
                {t("ai_traces.columns.throughput")}
              </TableHead>
              <TableHead className="w-[90px] text-right">
                {t("ai_traces.columns.duration")}
              </TableHead>
              <TableHead className="w-[110px]">
                {t("ai_traces.columns.finishReason")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center py-12">
                  <Loader className="mx-auto w-8 text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="text-center py-12 text-muted-foreground"
                >
                  {t("ai_traces.empty")}
                </TableCell>
              </TableRow>
            )}
            {items.map((row) => (
              <TableRow
                // request_id is unique only within a workspace; the All view
                // mixes workspaces, so qualify the key to avoid collisions.
                key={`${row.workspace}/${row.request_id}`}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelected(row)}
              >
                <TableCell className="font-mono text-xs">
                  <Timestamp
                    timestamp={row.time}
                    format="YYYY-MM-DD HH:mm:ss"
                  />
                </TableCell>
                {isAllWorkspaces && (
                  <TableCell className="text-sm truncate max-w-[140px]">
                    {row.workspace || (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <div className="text-sm">{row.endpoint_name || "-"}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.endpoint_type || ""}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {userAgentToApp(row.user_agent) || (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {row.response_model || row.request_model || "-"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.response_status} />
                </TableCell>
                <TableCell className="text-sm truncate max-w-[140px]">
                  {keyName(row.api_key_id) || (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatTokens(row.total_tokens) ?? "-"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatThroughput(row.completion_tokens, row.duration_ms)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatDuration(row.duration_ms)}
                </TableCell>
                <TableCell className="text-xs font-mono">
                  {row.finish_reason || (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {hasNextPage && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {isFetchingNextPage && (
            <Loader className="w-6 text-muted-foreground" />
          )}
        </div>
      )}

      <TraceDetailDrawer
        trace={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </ListPage>
  );
};

// userAgentToApp picks a short app label from the request's User-Agent — the
// SDK / client name when we recognise it, otherwise the leading token.
function userAgentToApp(ua?: string): string {
  if (!ua) return "";
  if (ua.startsWith("claude-cli")) return "Claude Code";
  if (ua.includes("claude.ai")) return "claude.ai";
  if (ua.includes("openai")) return "OpenAI SDK";
  if (ua.includes("anthropic")) return "Anthropic SDK";
  if (ua.includes("openrouter")) return "OpenRouter";
  const m = ua.match(/^[^/\s]+/);
  return m ? m[0] : ua.slice(0, 24);
}

// formatThroughput renders completion tokens per second as "X.X tok/s".
function formatThroughput(
  completionTokens?: number,
  durationMs?: number,
): React.ReactNode {
  if (completionTokens == null || !durationMs) {
    return <span className="text-muted-foreground">-</span>;
  }
  const tps = completionTokens / (durationMs / 1000);
  return `${tps.toFixed(1)} tok/s`;
}

// formatDuration renders the request duration in seconds with 2 decimals.
function formatDuration(durationMs?: number): React.ReactNode {
  if (durationMs == null) {
    return <span className="text-muted-foreground">-</span>;
  }
  return `${(durationMs / 1000).toFixed(2)} s`;
}

const StatusBadge = ({ status }: { status: number }) => {
  if (status >= 200 && status < 300) {
    return <Badge variant="default">{status}</Badge>;
  }
  if (status >= 400 && status < 500) {
    return <Badge variant="outline">{status}</Badge>;
  }
  return <Badge variant="destructive">{status || "-"}</Badge>;
};
