import type {
  PerformanceTimeRange,
  PerformanceTrendMetric,
  PerformanceTrendSeries,
  PerformanceWindow,
} from "@/domains/endpoint/hooks/use-endpoint-performance-trends";

type PerformanceTrendRow = {
  timestamp: number;
} & Partial<Record<PerformanceTrendMetric, number>>;

export function performanceTrendRows(
  series: PerformanceTrendSeries[],
  metrics: PerformanceTrendMetric[],
): PerformanceTrendRow[] {
  const included = new Set(metrics);
  const rows = new Map<number, PerformanceTrendRow>();

  for (const item of series) {
    if (!included.has(item.metric)) continue;

    for (const point of item.points) {
      const row = rows.get(point.timestamp) ?? { timestamp: point.timestamp };
      row[item.metric] = point.value;
      rows.set(point.timestamp, row);
    }
  }

  return Array.from(rows.values()).sort(
    (left, right) => left.timestamp - right.timestamp,
  );
}

export function performanceTrendLatestRow(
  series: PerformanceTrendSeries[],
  metrics: PerformanceTrendMetric[],
): PerformanceTrendRow | undefined {
  return performanceTrendRows(series, metrics).at(-1);
}

export function performanceRangeDisplayWindow(
  range: PerformanceTimeRange,
): PerformanceWindow {
  if (range.kind === "preset") return range.window;

  const durationSeconds = range.end - range.start;
  if (durationSeconds <= 10 * 60) return "5m";
  if (durationSeconds <= 2 * 60 * 60) return "1h";
  return "24h";
}

export function performanceTrendTicks(rows: PerformanceTrendRow[]): number[] {
  if (rows.length <= 1) return rows.map((row) => row.timestamp);
  return [
    rows[0].timestamp,
    rows[Math.floor((rows.length - 1) / 2)].timestamp,
    rows[rows.length - 1].timestamp,
  ];
}

export function formatPerformanceTrendTimestamp(
  timestamp: number,
  window: PerformanceWindow,
): string {
  const date = new Date(timestamp * 1000);

  if (window === "5m") {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  }

  if (window === "1h") {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatPerformanceTrendAxisTick(
  timestamp: number,
  window: PerformanceWindow,
): string {
  const date = new Date(timestamp * 1000);

  if (window === "24h") {
    return new Intl.DateTimeFormat(undefined, {
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
