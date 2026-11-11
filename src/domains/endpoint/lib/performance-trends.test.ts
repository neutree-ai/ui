import { describe, expect, it } from "vitest";
import type { PerformanceTrendSeries } from "@/domains/endpoint/hooks/use-endpoint-performance-trends";
import {
  performanceRangeDisplayWindow,
  performanceTrendLatestRow,
  performanceTrendRows,
} from "./performance-trends";

const series: PerformanceTrendSeries[] = [
  {
    metric: "prompt_tokens_per_second",
    unit: "tokens_per_second",
    points: [
      { timestamp: 10, value: 100 },
      { timestamp: 20, value: 120 },
    ],
  },
  {
    metric: "generation_tokens_per_second",
    unit: "tokens_per_second",
    points: [{ timestamp: 20, value: 30 }],
  },
];

describe("performanceTrendRows", () => {
  it("joins selected metrics into one timestamp-ordered series", () => {
    expect(
      performanceTrendRows(series, [
        "prompt_tokens_per_second",
        "generation_tokens_per_second",
      ]),
    ).toEqual([
      { timestamp: 10, prompt_tokens_per_second: 100 },
      {
        timestamp: 20,
        prompt_tokens_per_second: 120,
        generation_tokens_per_second: 30,
      },
    ]);
  });

  it("does not add unselected metrics to the chart rows", () => {
    expect(
      performanceTrendRows(series, ["generation_tokens_per_second"]),
    ).toEqual([{ timestamp: 20, generation_tokens_per_second: 30 }]);
  });
});

describe("performanceTrendLatestRow", () => {
  it("returns the values from the latest timestamp shared by the charts", () => {
    expect(
      performanceTrendLatestRow(series, [
        "prompt_tokens_per_second",
        "generation_tokens_per_second",
      ]),
    ).toEqual({
      timestamp: 20,
      prompt_tokens_per_second: 120,
      generation_tokens_per_second: 30,
    });
  });
});

describe("performanceRangeDisplayWindow", () => {
  it("uses the closest compact axis mode for a custom range", () => {
    expect(
      performanceRangeDisplayWindow({
        kind: "custom",
        start: 0,
        end: 8 * 60,
      }),
    ).toBe("5m");
    expect(
      performanceRangeDisplayWindow({
        kind: "custom",
        start: 0,
        end: 90 * 60,
      }),
    ).toBe("1h");
    expect(
      performanceRangeDisplayWindow({
        kind: "custom",
        start: 0,
        end: 3 * 24 * 60 * 60,
      }),
    ).toBe("24h");
  });
});
