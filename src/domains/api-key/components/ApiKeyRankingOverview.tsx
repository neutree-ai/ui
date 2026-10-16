import { useRef } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ApiKeyTraffic } from "@/domains/api-key/hooks/use-api-key-policy";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatTokenQuota } from "@/foundation/lib/token-quota";
import { cn } from "@/foundation/lib/utils";

// Per-key reference (id + display name) for attributing ranking entries.
type RankingKeyRef = { id: string; name: string; description?: string | null };

// Top-3 + "others" donut slice colors (blue / green / amber / muted-gray).
const SLICE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#cbd5e1"];

type Entry = { name: string; description?: string | null; value: number };

// One ranking line: rank, key name, its description, and the value share. The
// description is user-authored and can be arbitrarily long, so the text column
// stays a single truncated line, and only a line that is actually clipped
// carries the full text on a Tooltip — hover and keyboard focus both reach it.
const RankingRow = ({
  rank,
  entry,
  total,
  format,
}: {
  rank: number;
  entry: Entry;
  total: number;
  format: (n: number) => string;
}) => {
  const labelRef = useRef<HTMLSpanElement>(null);
  const labelTruncated = useIsTruncated(labelRef);
  const share = total > 0 ? Math.round((entry.value / total) * 100) : 0;
  const fullLabel = `${rank}. ${entry.name}${
    entry.description ? ` - ${entry.description}` : ""
  }`;

  const label = (
    <span
      ref={labelRef}
      data-testid="api-key-ranking-entry"
      tabIndex={labelTruncated ? 0 : undefined}
      className={cn(
        "min-w-0 truncate text-muted-foreground",
        labelTruncated &&
          "focus-visible:outline-none focus-visible:[box-shadow:var(--nt-outline-active-focus)]",
      )}
    >
      {rank}. {entry.name}
      {entry.description ? (
        <span className="ml-1 text-[10px] font-normal text-muted-foreground/70">
          - {entry.description}
        </span>
      ) : null}
    </span>
  );

  return (
    <li className="flex justify-between gap-2">
      {labelTruncated ? (
        <Tooltip>
          <TooltipTrigger asChild>{label}</TooltipTrigger>
          <TooltipContent className="max-w-md break-all">
            {fullLabel}
          </TooltipContent>
        </Tooltip>
      ) : (
        label
      )}
      <span className="shrink-0 font-medium tabular-nums">
        {format(entry.value)} · {share}%
      </span>
    </li>
  );
};

const RankingPanel = ({
  title,
  entries,
  format,
}: {
  title: string;
  entries: Entry[];
  format: (n: number) => string;
}) => {
  const { t } = useTranslation();
  const total = entries.reduce((s, e) => s + e.value, 0);
  // Rank by value descending before taking the top 3 (input is unsorted).
  const top = entries
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  const others = total - top.reduce((s, e) => s + e.value, 0);
  const pie = [
    ...top.map((e) => ({ name: e.name, value: e.value })),
    ...(others > 0 ? [{ name: "others", value: others }] : []),
  ];

  return (
    // `min-w-0` is load-bearing. As a flex item this panel's automatic minimum
    // size is the min-content width of a ranking line, and that line is
    // `white-space: nowrap` (it is truncated) — so the panel used to grow to the
    // full unwrapped description and scroll the whole page sideways. The
    // `min-w-0`/`truncate` further down only shrink the line itself; they cannot
    // pull the panel's own minimum back down.
    <div className="flex min-w-0 flex-1 items-center gap-4 rounded-md border p-4">
      <div className="h-20 w-20 shrink-0">
        {total > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pie}
                dataKey="value"
                nameKey="name"
                innerRadius={22}
                outerRadius={38}
                stroke="none"
                isAnimationActive={false}
              >
                {pie.map((_, i) => (
                  <Cell
                    key={i}
                    fill={SLICE_COLORS[Math.min(i, SLICE_COLORS.length - 1)]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div
            aria-hidden="true"
            className="h-full w-full rounded-full border border-dashed"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        {top.length > 0 ? (
          <ol className="mt-1 space-y-0.5 text-xs">
            {top.map((e, i) => (
              <RankingRow
                key={e.name}
                rank={i + 1}
                entry={e}
                total={total}
                format={format}
              />
            ))}
          </ol>
        ) : (
          <div className="mt-1 text-xs text-muted-foreground">
            {t("api_keys.ranking.empty")}
          </div>
        )}
      </div>
    </div>
  );
};

// "APIKey 排名概览": request-count and token rankings over the last 24h, each a
// donut + top-3 list. Backed by inference-trace aggregates (useAllApiKeyTraffic).
export const ApiKeyRankingOverview = ({
  keys,
  traffic,
}: {
  keys: RankingKeyRef[];
  traffic: Map<string, ApiKeyTraffic>;
}) => {
  const { t } = useTranslation();

  const requestEntries: Entry[] = keys.map((k) => ({
    name: k.name,
    description: k.description,
    value: traffic.get(k.id)?.requests ?? 0,
  }));
  const tokenEntries: Entry[] = keys.map((k) => ({
    name: k.name,
    description: k.description,
    value: traffic.get(k.id)?.tokens ?? 0,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold">
              {t("api_keys.ranking.title")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("api_keys.ranking.subtitle")}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {t("api_keys.ranking.window")}
          </Badge>
        </div>
      </CardHeader>
      {/* Two panels only fit side by side once each one is wide enough for the
          donut *and* a readable ranking line. At `sm` the page still carries the
          sidebar, so 800px leaves ~229px per panel and the line collapses to a
          few characters; below `lg` they stack instead. */}
      <CardContent className="flex flex-col gap-3 lg:flex-row">
        <RankingPanel
          title={t("api_keys.ranking.requests")}
          entries={requestEntries}
          format={(n) => n.toLocaleString()}
        />
        <RankingPanel
          title={t("api_keys.ranking.tokens")}
          entries={tokenEntries}
          format={formatTokenQuota}
        />
      </CardContent>
    </Card>
  );
};
