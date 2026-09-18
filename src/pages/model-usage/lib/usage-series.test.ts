import { describe, expect, it } from "vitest";
import type { ApiUsageRecord } from "@/domains/api-key/types";
import {
  aggregateSeries,
  buildTrend,
  foldRemainder,
  OTHER_SERIES_KEY,
} from "@/pages/model-usage/lib/usage-series";

const record = (
  overrides: Partial<ApiUsageRecord> & { date: string },
): ApiUsageRecord => ({
  api_key_id: "key-1",
  api_key_name: "key-1",
  api_key_display_name: null,
  endpoint_type: "endpoint",
  endpoint_name: "internal",
  model_name: "model-a",
  workspace: "design-lab",
  prompt_tokens: 80,
  completion_tokens: 20,
  usage: 100,
  ...overrides,
});

const byKey = (r: ApiUsageRecord) => r.api_key_id;
const metaOfKey = (r: ApiUsageRecord) => ({
  name: r.api_key_display_name || r.api_key_name,
  description: r.api_key_description ?? null,
});

describe("aggregateSeries", () => {
  it("sums prompt/completion/usage per key and sorts by total desc", () => {
    const series = aggregateSeries(
      [
        record({ date: "2026-09-01", api_key_id: "small", usage: 10 }),
        record({
          date: "2026-09-01",
          api_key_id: "big",
          api_key_display_name: "Big key",
          api_key_description: "owned by ops",
          prompt_tokens: 240,
          completion_tokens: 60,
          usage: 300,
        }),
        record({
          date: "2026-09-02",
          api_key_id: "big",
          prompt_tokens: 160,
          completion_tokens: 40,
          usage: 200,
        }),
      ],
      byKey,
      metaOfKey,
    );

    expect(series.map((s) => s.key)).toEqual(["big", "small"]);
    expect(series[0]).toMatchObject({
      name: "Big key",
      description: "owned by ops",
      prompt: 400,
      completion: 100,
      total: 500,
    });
  });
});

describe("foldRemainder", () => {
  const series = [300, 200, 100, 50, 10].map((total, i) => ({
    key: `k${i}`,
    name: `key ${i}`,
    description: null,
    prompt: total * 0.8,
    completion: total * 0.2,
    total,
  }));

  it("returns the series untouched when they already fit", () => {
    expect(foldRemainder(series.slice(0, 2), 2, () => "other")).toEqual(
      series.slice(0, 2),
    );
  });

  it("folds the tail into one other series carrying the combined totals", () => {
    const folded = foldRemainder(series, 2, (n) => `Other ${n} keys`);

    expect(folded).toHaveLength(3);
    expect(folded[2]).toMatchObject({
      key: OTHER_SERIES_KEY,
      name: "Other 3 keys",
      total: 160,
      hiddenCount: 3,
    });
    expect(folded[2].prompt).toBeCloseTo(128);
    expect(folded[2].completion).toBeCloseTo(32);
  });
});

describe("buildTrend", () => {
  it("keeps every date and zero-fills series that had no usage that day", () => {
    const rows = [
      record({ date: "2026-09-02", api_key_id: "a", usage: 5 }),
      record({ date: "2026-09-01", api_key_id: "a", usage: 3 }),
      record({ date: "2026-09-01", api_key_id: "b", usage: 7 }),
    ];
    const series = aggregateSeries(rows, byKey, metaOfKey);

    expect(buildTrend(rows, series, byKey)).toEqual([
      { date: "2026-09-01", a: 3, b: 7 },
      { date: "2026-09-02", a: 5, b: 0 },
    ]);
  });
});
