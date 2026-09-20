import type { ApiUsageRecord } from "@/domains/api-key/types";

// One aggregated series — in the multi-day chart a line, in the single-day
// chart a bar. `prompt`/`completion` are what the stacked day bars need; the
// trend chart only reads `total`.
export type UsageSeries = {
  key: string;
  name: string;
  description: string | null;
  prompt: number;
  completion: number;
  total: number;
  // Only set on the folded "other" series: how many series it stands for.
  hiddenCount?: number;
};

// The synthetic series that carries every series outside the top K. It has one
// definition because the chart, the tooltip and the tests all branch on it.
export const OTHER_SERIES_KEY = "__other";

type SeriesMeta = { name: string; description: string | null };

// Sums usage into one series per key, biggest total first.
export function aggregateSeries(
  rows: ApiUsageRecord[],
  keyOf: (r: ApiUsageRecord) => string,
  metaOf: (r: ApiUsageRecord) => SeriesMeta,
): UsageSeries[] {
  const byKey = new Map<string, UsageSeries>();
  for (const r of rows) {
    const key = keyOf(r);
    let series = byKey.get(key);
    if (!series) {
      const meta = metaOf(r);
      series = {
        key,
        name: meta.name,
        description: meta.description,
        prompt: 0,
        completion: 0,
        total: 0,
      };
      byKey.set(key, series);
    }
    series.prompt += r.prompt_tokens ?? 0;
    series.completion += r.completion_tokens ?? 0;
    series.total += r.usage ?? 0;
  }
  return [...byKey.values()].sort((a, b) => b.total - a.total);
}

// Keeps the `limit` biggest series and folds the rest into one "other" series
// holding their combined totals. A list that already fits is returned as-is, so
// a small workspace never sees an empty "other" entry.
//
// Why fold at all: every series is a tooltip row, and a tooltip taller than the
// chart card overflows it. Folding bounds the row count at limit + 1.
export function foldRemainder(
  series: UsageSeries[],
  limit: number,
  otherName: (hiddenCount: number) => string,
): UsageSeries[] {
  if (series.length <= limit) return series;
  const rest = series.slice(limit);
  return [
    ...series.slice(0, limit),
    {
      key: OTHER_SERIES_KEY,
      name: otherName(rest.length),
      description: null,
      prompt: rest.reduce((sum, s) => sum + s.prompt, 0),
      completion: rest.reduce((sum, s) => sum + s.completion, 0),
      total: rest.reduce((sum, s) => sum + s.total, 0),
      hiddenCount: rest.length,
    },
  ];
}

// Rows for the multi-day trend chart: one row per date with a numeric field per
// series. Days a series did not use get 0 rather than a gap, so every line stays
// continuous across the window.
export function buildTrend(
  rows: ApiUsageRecord[],
  series: UsageSeries[],
  keyOf: (r: ApiUsageRecord) => string,
): Array<Record<string, number | string>> {
  const byDate = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const key = keyOf(r);
    const day = byDate.get(r.date) ?? {};
    day[key] = (day[key] ?? 0) + (r.usage ?? 0);
    byDate.set(r.date, day);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, perSeries]) => {
      const point: Record<string, number | string> = { date };
      for (const s of series) point[s.key] = perSeries[s.key] ?? 0;
      return point;
    });
}
