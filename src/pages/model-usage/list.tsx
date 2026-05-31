import { useParsed } from "@refinedev/core";
import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
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
import { ListPage } from "@/foundation/components/ListPage";
import { Loader } from "@/foundation/components/Loader";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatTokens } from "@/foundation/lib/unit";

type DayTotals = {
  date: string;
  prompt: number;
  completion: number;
  total: number;
};

type NamedTotals = {
  key: string;
  name: string;
  prompt: number;
  completion: number;
  total: number;
};

export const ModelUsageList = () => {
  const { t } = useTranslation();
  const { params } = useParsed();
  const workspace = (params?.workspace as string) ?? "";

  const [days, setDays] = useState(30);
  const { startDate, endDate } = useMemo(() => dateRange(days), [days]);

  const { usageData, isLoading, error } = useWorkspaceUsage(
    workspace,
    startDate,
    endDate,
  );

  const daily = useMemo(() => aggregateByDay(usageData), [usageData]);
  const byKey = useMemo(
    () =>
      aggregateBy(
        usageData,
        (r) => r.api_key_id,
        (r) => r.api_key_name,
      ),
    [usageData],
  );
  const byModel = useMemo(
    () =>
      aggregateBy(
        usageData,
        (r) => r.model_name ?? "-",
        (r) => r.model_name ?? "-",
      ),
    [usageData],
  );

  const totalTokens = daily.reduce((sum, d) => sum + d.total, 0);

  return (
    <ListPage
      title={t("model_usage.title")}
      canCreate={false}
      breadcrumb={false}
      extra={
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">{t("model_usage.range.7")}</SelectItem>
            <SelectItem value="30">{t("model_usage.range.30")}</SelectItem>
            <SelectItem value="90">{t("model_usage.range.90")}</SelectItem>
          </SelectContent>
        </Select>
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
        <div className="h-[160px]">
          {isLoading && daily.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Loader className="w-8 text-muted-foreground" />
            </div>
          ) : daily.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("model_usage.empty")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={daily}
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
                  content={<DailyTooltip />}
                />
                <Bar
                  dataKey="prompt"
                  stackId="tokens"
                  fill="hsl(var(--primary))"
                />
                <Bar
                  dataKey="completion"
                  stackId="tokens"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.4}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
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

const DailyTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DayTotals }>;
}) => {
  const { t } = useTranslation();
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded border bg-popover px-2 py-1 text-xs shadow">
      <div className="font-medium">{d.date}</div>
      <div className="text-muted-foreground">
        {t("model_usage.daily.tooltip.prompt")}: {formatTokens(d.prompt)}
      </div>
      <div className="text-muted-foreground">
        {t("model_usage.daily.tooltip.completion")}:{" "}
        {formatTokens(d.completion)}
      </div>
      <div className="text-muted-foreground">
        {t("model_usage.daily.tooltip.total")}: {formatTokens(d.total)}
      </div>
    </div>
  );
};

// dateRange returns an inclusive [start, end] window of the trailing `days`
// days as YYYY-MM-DD strings, suitable for the RPC's DATE params.
function dateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function aggregateByDay(rows: ApiUsageRecord[]): DayTotals[] {
  const byDate = new Map<string, DayTotals>();
  for (const r of rows) {
    const cur = byDate.get(r.date) ?? {
      date: r.date,
      prompt: 0,
      completion: 0,
      total: 0,
    };
    cur.prompt += r.prompt_tokens ?? 0;
    cur.completion += r.completion_tokens ?? 0;
    cur.total += r.usage ?? 0;
    byDate.set(r.date, cur);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
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
