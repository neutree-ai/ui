import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiKeyTraffic } from "@/domains/api-key/hooks/use-api-key-policy";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatTokenQuota } from "@/foundation/lib/token-quota";

// Per-key reference (id + display name) for attributing ranking entries.
type RankingKeyRef = { id: string; name: string };

// Top-3 + "others" donut slice colors (blue / green / amber / muted-gray).
const SLICE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#cbd5e1"];

type Entry = { name: string; value: number };

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
    <div className="flex flex-1 items-center gap-4 rounded-md border p-4">
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
          <div className="flex h-full w-full items-center justify-center rounded-full border border-dashed text-[10px] text-muted-foreground">
            —
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        {top.length > 0 ? (
          <ol className="mt-1 space-y-0.5 text-xs">
            {top.map((e, i) => (
              <li key={e.name} className="flex justify-between gap-2">
                <span className="truncate text-muted-foreground">
                  {i + 1}. {e.name}
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {format(e.value)} ·{" "}
                  {total > 0 ? Math.round((e.value / total) * 100) : 0}%
                </span>
              </li>
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
    value: traffic.get(k.id)?.requests ?? 0,
  }));
  const tokenEntries: Entry[] = keys.map((k) => ({
    name: k.name,
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
      <CardContent className="flex flex-col gap-3 sm:flex-row">
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
