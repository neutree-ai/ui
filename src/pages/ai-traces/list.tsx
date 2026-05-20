import { useParsed } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
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
import { ListPage } from "@/foundation/components/ListPage";
import { Loader } from "@/foundation/components/Loader";
import Timestamp from "@/foundation/components/Timestamp";
import { type AITrace, fetchAITraces } from "@/foundation/lib/api/ai-traces";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { TraceDetailDrawer } from "./components/TraceDetailDrawer";
import { TraceStatsChart } from "./components/TraceStatsChart";

const LIMIT = 50;

export const AITracesList = () => {
  const { t } = useTranslation();
  const { params } = useParsed();
  const workspace = (params?.workspace as string) ?? "";

  const [endpointName, setEndpointName] = useState("");
  const [endpointType, setEndpointType] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [model, setModel] = useState("");
  const [selected, setSelected] = useState<AITrace | null>(null);

  const queryArgs = {
    workspace,
    endpoint_name: endpointName.trim() || undefined,
    endpoint_type: endpointType || undefined,
    status: status || undefined,
    model: model.trim() || undefined,
    limit: LIMIT,
  };

  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["ai-traces", queryArgs],
    queryFn: ({ signal }) => fetchAITraces(queryArgs, signal),
    enabled: Boolean(workspace),
  });

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["ai-trace-stats"] });
  };

  const items = data?.items ?? [];

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
              <TableHead>{t("ai_traces.columns.endpoint")}</TableHead>
              <TableHead>{t("ai_traces.columns.model")}</TableHead>
              <TableHead className="w-[100px]">
                {t("ai_traces.columns.status")}
              </TableHead>
              <TableHead className="w-[120px] text-right">
                {t("ai_traces.columns.tokens")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <Loader className="mx-auto w-8 text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-12 text-muted-foreground"
                >
                  {t("ai_traces.empty")}
                </TableCell>
              </TableRow>
            )}
            {items.map((row) => (
              <TableRow
                key={row.request_id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelected(row)}
              >
                <TableCell className="font-mono text-xs">
                  <Timestamp
                    timestamp={row.time}
                    format="YYYY-MM-DD HH:mm:ss"
                  />
                </TableCell>
                <TableCell>
                  <div className="text-sm">{row.endpoint_name || "-"}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.endpoint_type || ""}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {row.response_model || row.request_model || "-"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.response_status} />
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {row.total_tokens != null ? row.total_tokens : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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

const StatusBadge = ({ status }: { status: number }) => {
  if (status >= 200 && status < 300) {
    return <Badge variant="default">{status}</Badge>;
  }
  if (status >= 400 && status < 500) {
    return <Badge variant="outline">{status}</Badge>;
  }
  return <Badge variant="destructive">{status || "-"}</Badge>;
};
