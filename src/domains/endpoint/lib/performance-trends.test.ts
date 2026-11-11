import { describe, expect, it } from "vitest";
import type { PerformanceTrendSeries } from "@/domains/endpoint/hooks/use-endpoint-performance-trends";
import {
  formatPerformanceTrendAxisTick,
  formatPerformanceTrendTimestamp,
  performanceRangeDisplayWindow,
  performanceTooltipItems,
  performanceTrendLatestRow,
  performanceTrendRows,
  performanceTrendTicks,
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
  it("keeps a preset's own axis mode", () => {
    expect(
      performanceRangeDisplayWindow({ kind: "preset", window: "24h" }),
    ).toBe("24h");
  });

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

describe("performanceTrendTicks", () => {
  it.each([
    { rows: [], expected: [] },
    { rows: [{ timestamp: 10 }], expected: [10] },
    {
      rows: [{ timestamp: 10 }, { timestamp: 20 }, { timestamp: 30 }],
      expected: [10, 20, 30],
    },
  ])(
    "selects up to three ticks from $rows.length rows",
    ({ rows, expected }) => {
      expect(performanceTrendTicks(rows)).toEqual(expected);
    },
  );
});

describe("performance trend timestamp formatting", () => {
  const timestamp = Date.UTC(2026, 0, 2, 3, 4, 5) / 1000;

  it.each([
    ["5m", /03:04:05/],
    ["1h", /03:04/],
    ["24h", /01\/02, 03:04/],
  ] as const)("formats a %s timestamp for its tooltip", (window, expected) => {
    expect(formatPerformanceTrendTimestamp(timestamp, window)).toMatch(
      expected,
    );
  });

  it.each([
    ["24h", /01\/02/],
    ["1h", /03:04/],
    ["5m", /03:04/],
  ] as const)("formats a %s axis tick", (window, expected) => {
    expect(formatPerformanceTrendAxisTick(timestamp, window)).toMatch(expected);
  });
});

describe("performanceTooltipItems", () => {
  const lines = [{ metric: "a" }, { metric: "b" }, { metric: "c" }];

  it("keeps lines with a numeric value, in line order and with their index", () => {
    expect(
      performanceTooltipItems(lines, [
        { dataKey: "c", value: 3 },
        { dataKey: "a", value: 1 },
        { dataKey: "b" },
        { dataKey: 7, value: 9 },
      ]),
    ).toEqual([
      { line: lines[0], index: 0, value: 1 },
      { line: lines[2], index: 2, value: 3 },
    ]);
  });

  it("returns nothing without a payload", () => {
    expect(performanceTooltipItems(lines)).toEqual([]);
  });
});
