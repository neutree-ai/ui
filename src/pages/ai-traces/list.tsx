import { useList, useParsed } from "@refinedev/core";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { ApiKeyLabel } from "@/domains/api-key/components/ApiKeyLabel";
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
import { StatusCodeFilter } from "./components/StatusCodeFilter";
import { TraceDetailDrawer } from "./components/TraceDetailDrawer";
import { TraceStatsChart } from "./components/TraceStatsChart";
import { StatusBadge } from "./status";

const LIMIT = 50;

// Traces are retained for at most 30 days, so a longer quick pick would only
// ever return a partial window.
const TRACE_RANGE_PRESETS = [7, 30];

export const AITracesList = () => {
  const { t } = useTranslation();
  const { params } = useParsed();
  const workspace = (params?.workspace as string) ?? "";
  // "All workspaces" aggregates traces across workspaces, so show a workspace
  // column to disambiguate rows (it is redundant on a single-workspace view).
  const isAllWorkspaces = workspace === ALL_WORKSPACES;
  const colSpan = isAllWorkspaces ? 13 : 12;

  const [endpointName, setEndpointName] = useState(() =>
    String(params?.endpoint_name ?? ""),
  );
  const [endpointType, setEndpointType] = useState(() =>
    String(params?.endpoint_type ?? ""),
  );
  const [status, setStatus] = useState(() => String(params?.status ?? ""));
  const [model, setModel] = useState("");
  // Pre-fill the api-key filter from ?api_key_id=… so the API-key detail page's
  // "view call logs" link lands here scoped to that key.
  const [apiKeyId, setApiKeyId] = useState<string>(
    () => (params?.api_key_id as string) ?? "",
  );
  const [finishReason, setFinishReason] = useState<string>("");
  const [requestId, setRequestId] = useState(() =>
    String(params?.request_id ?? ""),
  );
  const [requestModel, setRequestModel] = useState(() =>
    String(params?.request_model ?? ""),
  );
  const [upstream, setUpstream] = useState(() =>
    String(params?.upstream ?? ""),
  );
  const [upstreamModel, setUpstreamModel] = useState(() =>
    String(params?.upstream_model ?? ""),
  );
  const [requestMode, setRequestMode] = useState(() =>
    params?.request_mode === "stream" || params?.request_mode === "non_stream"
      ? params.request_mode
      : "",
  );
  const [range, setRange] = useState<DateRange>(() => {
    const from = Number(params?.from);
    const to = Number(params?.to);
    if (
      Number.isFinite(from) &&
      Number.isFinite(to) &&
      from > 0 &&
      to >= from &&
      dayjs(from).isValid() &&
      dayjs(to).isValid()
    ) {
      return { start: dayjs(from).toISOString(), end: dayjs(to).toISOString() };
    }
    return trailingRange(7);
  });
  const preciseRange = range.start.includes("T");
  const routingFilters = Boolean(
    requestModel || upstream || upstreamModel || requestMode,
  );
  const scoped = Boolean(
    requestId.trim() ||
      routingFilters ||
      endpointName ||
      endpointType ||
      status ||
      model ||
      apiKeyId ||
      finishReason ||
      preciseRange,
  );
  const [selected, setSelected] = useState<AITrace | null>(null);

  // Workspace's API keys — for both the filter dropdown and id→name resolution
  // in the table cell.
  const { data: keysData } = useList<{
    id: string;
    metadata?: { name?: string; display_name?: string };
    spec?: { description?: string };
  }>({
    resource: "api_keys",
    pagination: { mode: "off" },
    meta: { workspace },
    queryOptions: { enabled: Boolean(workspace) },
  });
  const keys = keysData?.data ?? [];
  const keysById = new Map(keys.map((key) => [key.id, key]));

  // What the closed control shows: the key's name, one line. The description
  // stays in the list, where there is room for it.
  const selectedKey = keys.find((key) => key.id === apiKeyId);

  const queryArgs = {
    workspace,
    endpoint_name: endpointName.trim() || undefined,
    endpoint_type: endpointType || undefined,
    status: status || undefined,
    model: model.trim() || undefined,
    api_key_id: apiKeyId || undefined,
    finish_reason: finishReason || undefined,
    request_id: requestId.trim() || undefined,
    request_model: requestModel.trim() || undefined,
    upstream: upstream.trim() || undefined,
    upstream_model: upstreamModel.trim() || undefined,
    request_mode: requestMode || undefined,
    // Dashboard links carry exact instants; calendar selections cover whole days.
    start: preciseRange
      ? range.start
      : dayjs(range.start).startOf("day").toISOString(),
    end: preciseRange ? range.end : dayjs(range.end).endOf("day").toISOString(),
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
      {!scoped && <TraceStatsChart workspace={workspace} range={range} />}

      <div className="mb-4 flex flex-wrap items-center gap-2 [&>button]:h-8 [&_input]:h-8 [&_[role=combobox]]:h-8">
        <DateRangePicker
          className="h-8"
          value={range}
          onChange={setRange}
          presets={TRACE_RANGE_PRESETS}
        />
        <Input
          className="w-[280px]"
          aria-label={t("ai_traces.filters.requestId")}
          placeholder={t("ai_traces.filters.requestId")}
          value={requestId}
          onChange={(e) => setRequestId(e.target.value)}
        />
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
        <StatusCodeFilter value={status} onChange={setStatus} />
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
            <SelectValue placeholder={t("ai_traces.filters.apiKey")}>
              {/* The control always has a value — "all" is the no-filter
                  entry — so what it shows is spelled out rather than left to
                  the selected item's own markup, which is two lines tall. */}
              <ApiKeyLabel
                variant="inline"
                name={
                  apiKeyId
                    ? (selectedKey?.metadata?.name ?? apiKeyId)
                    : t("ai_traces.filters.allApiKeys")
                }
                displayName={
                  apiKeyId ? selectedKey?.metadata?.display_name : null
                }
              />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("ai_traces.filters.allApiKeys")}
            </SelectItem>
            {keys.map((k) => (
              <SelectItem key={k.id} value={k.id}>
                <ApiKeyLabel
                  name={k.metadata?.name ?? k.id}
                  displayName={k.metadata?.display_name}
                  description={k.spec?.description}
                />
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

      <details
        className="mb-4 rounded-md border p-3"
        open={routingFilters || undefined}
      >
        <summary className="cursor-pointer text-sm font-medium">
          {t("ai_traces.routing.filters")}
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["requestModel", requestModel, setRequestModel],
              ["upstream", upstream, setUpstream],
              ["upstreamModel", upstreamModel, setUpstreamModel],
            ] as const
          ).map(([key, value, setter]) => (
            <Input
              key={key}
              className="h-8 w-[200px]"
              aria-label={t(`ai_traces.routing.${key}`)}
              placeholder={t(`ai_traces.routing.${key}`)}
              value={value}
              onChange={(e) => setter(e.target.value)}
            />
          ))}
          <Select
            value={requestMode || "all"}
            onValueChange={(v) => setRequestMode(v === "all" ? "" : v)}
          >
            <SelectTrigger
              className="h-8 w-[160px]"
              aria-label={t("ai_traces.detail.stream")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("ai_traces.routing.allModes")}
              </SelectItem>
              <SelectItem value="stream">
                {t("ai_traces.detail.streamOn")}
              </SelectItem>
              <SelectItem value="non_stream">
                {t("ai_traces.detail.streamOff")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </details>
      {preciseRange && (
        <p className="mb-3 text-xs text-muted-foreground">
          {dayjs(range.start).format("YYYY-MM-DD HH:mm:ss")} –{" "}
          {dayjs(range.end).format("YYYY-MM-DD HH:mm:ss")}
          {" · "}
          {t("ai_traces.routing.timeHint")}
        </p>
      )}

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
              <TableHead className="min-w-[250px]">
                {t("ai_traces.columns.requestId")}
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
              <TableHead>{t("ai_traces.routing.target")}</TableHead>
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
                <TableCell className="font-mono text-xs whitespace-nowrap">
                  {row.request_id}
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
                  {row.request_model || row.response_model || "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {row.upstream || row.upstream_model ? (
                    <>
                      <div>{row.upstream || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.upstream_model || "—"}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.response_status} />
                </TableCell>
                <TableCell className="max-w-[140px] text-sm">
                  <ApiKeyLabel
                    name={keysById.get(row.api_key_id ?? "")?.metadata?.name}
                    displayName={
                      keysById.get(row.api_key_id ?? "")?.metadata?.display_name
                    }
                    description={
                      keysById.get(row.api_key_id ?? "")?.spec?.description
                    }
                  />
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
