import { useList, useParsed } from "@refinedev/core";
import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
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
import { useWorkspaceUsage } from "@/domains/api-key/hooks/use-workspace-usage";
import type { ApiUsageRecord } from "@/domains/api-key/types";
import {
  type DateRange,
  DateRangePicker,
  trailingRange,
} from "@/foundation/components/DateRangePicker";
import { ListPage } from "@/foundation/components/ListPage";
import { Loader } from "@/foundation/components/Loader";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatTokens } from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";

type NamedTotals = {
  key: string;
  name: string;
  prompt: number;
  completion: number;
  total: number;
};

// One day's tokens broken down per model: model names become dynamic keys
// (one stacked bar segment each) alongside `date` and `total`.
type DailyModelRow = {
  date: string;
  total: number;
  [model: string]: number | string;
};

// Distinct colors for the per-model stacked bars; cycles if a workspace has
// more models than colors.
const MODEL_COLORS = [
  "hsl(217 91% 60%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(271 81% 56%)",
  "hsl(0 84% 60%)",
  "hsl(199 89% 48%)",
  "hsl(330 81% 60%)",
  "hsl(160 84% 39%)",
  "hsl(48 96% 53%)",
  "hsl(240 5% 50%)",
];

export const ModelUsageList = () => {
  const { t } = useTranslation();
  const { params } = useParsed();
  const workspace = (params?.workspace as string) ?? "";

  const [range, setRange] = useState<DateRange>(() => trailingRange(30));
  const [apiKeyId, setApiKeyId] = useState<string>("");
  const [model, setModel] = useState("");

  const { usageData, isLoading, error, refetch } = useWorkspaceUsage(
    workspace,
    range.start,
    range.end,
  );

  // Workspace API keys for the filter dropdown (matches the trace list).
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

  const filtered = useMemo(
    () =>
      usageData.filter(
        (r) =>
          (!apiKeyId || r.api_key_id === apiKeyId) &&
          (!model ||
            (r.model_name ?? "")
              .toLowerCase()
              .includes(model.trim().toLowerCase())),
      ),
    [usageData, apiKeyId, model],
  );

  const { data: dailyData, models } = useMemo(
    () => aggregateDailyByModel(filtered),
    [filtered],
  );
  const byKey = useMemo(
    () =>
      aggregateBy(
        filtered,
        (r) => r.api_key_id,
        (r) => r.api_key_name,
      ),
    [filtered],
  );
  const byModel = useMemo(
    () =>
      aggregateBy(
        filtered,
        (r) => r.model_name ?? "-",
        (r) => r.model_name ?? "-",
      ),
    [filtered],
  );

  const totalTokens = filtered.reduce((sum, r) => sum + (r.usage ?? 0), 0);

  return (
    <ListPage
      title={t("model_usage.title")}
      canCreate={false}
      breadcrumb={false}
      extra={
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
          {t("model_usage.refresh")}
        </Button>
      }
    >
      <div className="border rounded-md p-4 mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm font-medium">
            {t("model_usage.daily.title")}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("model_usage.daily.totalTokens", {
              total: formatTokens(totalTokens),
            })}
          </span>
        </div>
        <div className="h-[200px]">
          {isLoading && dailyData.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Loader className="w-8 text-muted-foreground" />
            </div>
          ) : dailyData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("model_usage.empty")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dailyData}
                margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
              >
                <XAxis
                  dataKey="date"
                  tickFormatter={formatTick}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  interval="preserveStartEnd"
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  content={<ModelTooltip />}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {models.map((m, i) => (
                  <Bar
                    key={m}
                    dataKey={m}
                    stackId="models"
                    fill={MODEL_COLORS[i % MODEL_COLORS.length]}
                    radius={i === models.length - 1 ? [3, 3, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <DateRangePicker value={range} onChange={setRange} />
        <Select
          value={apiKeyId || "all"}
          onValueChange={(v) => setApiKeyId(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("model_usage.filters.apiKey")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("model_usage.filters.allApiKeys")}
            </SelectItem>
            {keys.map((k) => (
              <SelectItem key={k.id} value={k.id}>
                {k.metadata?.name ?? k.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-[200px]"
          placeholder={t("model_usage.filters.model")}
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
      </div>

      {error ? (
        <div className="text-sm text-destructive mb-2">{error.message}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <UsageTable
          title={t("model_usage.byApiKey")}
          nameHeader={t("model_usage.apiKey")}
          rows={byKey}
        />
        <UsageTable
          title={t("model_usage.byModel")}
          nameHeader={t("model_usage.model")}
          rows={byModel}
        />
      </div>
    </ListPage>
  );
};

const UsageTable = ({
  title,
  nameHeader,
  rows,
}: {
  title: string;
  nameHeader: string;
  rows: NamedTotals[];
}) => {
  const { t } = useTranslation();
  return (
    <div className="border rounded-md">
      <div className="px-4 py-2 text-sm font-medium border-b">{title}</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{nameHeader}</TableHead>
            <TableHead className="text-right">
              {t("model_usage.promptTokens")}
            </TableHead>
            <TableHead className="text-right">
              {t("model_usage.completionTokens")}
            </TableHead>
            <TableHead className="text-right">
              {t("model_usage.totalTokens")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center py-8 text-muted-foreground"
              >
                {t("model_usage.empty")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="truncate max-w-[160px]">
                  {r.name || <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatTokens(r.prompt)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatTokens(r.completion)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-medium">
                  {formatTokens(r.total)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

const ModelTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}) => {
  const { t } = useTranslation();
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter((p) => (p.value ?? 0) > 0);
  const total = payload.reduce((sum, p) => sum + (p.value ?? 0), 0);
  return (
    <div className="rounded border bg-popover px-2 py-1 text-xs shadow">
      <div className="font-medium mb-1">{label}</div>
      {rows.map((p) => (
        <div
          key={p.dataKey}
          className="flex items-center gap-1.5 text-muted-foreground"
        >
          <span
            className="inline-block size-2 rounded-sm"
            style={{ backgroundColor: p.color }}
          />
          <span className="truncate max-w-[160px]">{p.dataKey}</span>
          <span className="ml-auto font-mono">{formatTokens(p.value)}</span>
        </div>
      ))}
      <div className="mt-1 flex border-t pt-1">
        <span>{t("model_usage.daily.tooltip.total")}</span>
        <span className="ml-auto font-mono">{formatTokens(total)}</span>
      </div>
    </div>
  );
};

// aggregateDailyByModel buckets usage into per-day per-model token totals for a
// stacked bar chart, plus the list of model names (sorted by total desc) that
// become the stack segments.
function aggregateDailyByModel(rows: ApiUsageRecord[]): {
  data: DailyModelRow[];
  models: string[];
} {
  const byDate = new Map<string, Record<string, number>>();
  const modelTotals = new Map<string, number>();
  for (const r of rows) {
    const m = r.model_name ?? "-";
    const day = byDate.get(r.date) ?? {};
    day[m] = (day[m] ?? 0) + (r.usage ?? 0);
    byDate.set(r.date, day);
    modelTotals.set(m, (modelTotals.get(m) ?? 0) + (r.usage ?? 0));
  }
  const models = [...modelTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m);
  const data = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, perModel]) => {
      const row: DailyModelRow = { date, total: 0 };
      let total = 0;
      for (const m of models) {
        const v = perModel[m] ?? 0;
        row[m] = v;
        total += v;
      }
      row.total = total;
      return row;
    });
  return { data, models };
}

function aggregateBy(
  rows: ApiUsageRecord[],
  keyOf: (r: ApiUsageRecord) => string,
  nameOf: (r: ApiUsageRecord) => string,
): NamedTotals[] {
  const byKey = new Map<string, NamedTotals>();
  for (const r of rows) {
    const k = keyOf(r);
    const cur = byKey.get(k) ?? {
      key: k,
      name: nameOf(r),
      prompt: 0,
      completion: 0,
      total: 0,
    };
    cur.prompt += r.prompt_tokens ?? 0;
    cur.completion += r.completion_tokens ?? 0;
    cur.total += r.usage ?? 0;
    byKey.set(k, cur);
  }
  return [...byKey.values()].sort((a, b) => b.total - a.total);
}

// Converts a YYYY-MM-DD date into a compact M/D axis tick.
function formatTick(date: string): string {
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}
