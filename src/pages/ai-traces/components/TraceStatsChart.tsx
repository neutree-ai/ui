import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { DateRange } from "@/foundation/components/DateRangePicker";
import {
  type AITraceDayCount,
  fetchAITraceStats,
} from "@/foundation/lib/api/ai-traces";
import { useTranslation } from "@/foundation/lib/i18n";

export const TraceStatsChart = ({
  workspace,
  range,
}: {
  workspace: string;
  range: DateRange;
}) => {
  const { t } = useTranslation();

  // Mirror the list's [start-of-day, end-of-day] window so the chart follows
  // the same date-range filter (backend clamps the span to 90 day buckets).
  const start = dayjs(range.start).startOf("day").toISOString();
  const end = dayjs(range.end).endOf("day").toISOString();

  const { data } = useQuery({
    queryKey: ["ai-trace-stats", workspace, start, end],
    queryFn: ({ signal }) =>
      fetchAITraceStats(workspace, { start, end }, signal),
    enabled: Boolean(workspace),
  });

  const days = data?.days ?? [];
  // Hatch only the actual current (still-accumulating) day — the selected
  // window may end in the past, in which case no bar is in progress.
  const today = dayjs().format("YYYY-MM-DD");
  const total = days.reduce((sum, d) => sum + d.count, 0);
  // Thin the axis labels once there are too many day buckets to fit.
  const tickInterval = days.length > 14 ? "preserveStartEnd" : 0;

  return (
    <div className="mb-4 rounded-[var(--nt-radius-card)] border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)] p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-medium">
          {t("ai_traces.stats.title")}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("ai_traces.stats.totalRequests", { total })}
        </span>
      </div>
      <div className="h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={days}
            margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
          >
            <defs>
              {/* Diagonal hatch marks the current, in-progress day. */}
              <pattern
                id="trace-stats-today"
                patternUnits="userSpaceOnUse"
                width={6}
                height={6}
                patternTransform="rotate(45)"
              >
                <rect
                  width={6}
                  height={6}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.2}
                />
                <line
                  x1={0}
                  y1={0}
                  x2={0}
                  y2={6}
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                />
              </pattern>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={formatTick}
              tickLine={false}
              axisLine={false}
              fontSize={11}
              interval={tickInterval}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))" }}
              content={
                <StatsTooltip requestsLabel={t("ai_traces.stats.requests")} />
              }
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {days.map((d) => (
                <Cell
                  key={d.date}
                  fill={
                    d.date === today
                      ? "url(#trace-stats-today)"
                      : "hsl(var(--primary))"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const StatsTooltip = ({
  active,
  payload,
  requestsLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload: AITraceDayCount }>;
  requestsLabel: string;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded border bg-popover px-2 py-1 text-xs shadow">
      <div className="font-medium">{d.date}</div>
      <div className="text-muted-foreground">
        {requestsLabel}: {d.count}
      </div>
    </div>
  );
};

// Converts a YYYY-MM-DD date into a compact M/D axis tick.
function formatTick(date: string): string {
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}
