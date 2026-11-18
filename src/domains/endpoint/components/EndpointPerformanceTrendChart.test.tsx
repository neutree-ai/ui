import { render, screen, within } from "@testing-library/react";
import { describe, it } from "vitest";
import type { PerformanceTrendSeries } from "@/domains/endpoint/hooks/use-endpoint-performance-trends";
import {
  EndpointPerformanceTrendChart,
  type PerformanceTrendLine,
} from "./EndpointPerformanceTrendChart";

const series: PerformanceTrendSeries[] = [
  {
    metric: "prompt_tokens_per_second",
    unit: "tokens_per_second",
    points: [
      { timestamp: 10, value: 100 },
      { timestamp: 20, value: 120 },
    ],
  },
];

const line = (
  metric: PerformanceTrendLine["metric"],
  axis?: PerformanceTrendLine["axis"],
): PerformanceTrendLine => ({
  metric,
  label: `label:${metric}`,
  formatValue: String,
  axis,
});

const Chart = ({
  status = "ok",
  chartSeries = series,
  lines = [line("prompt_tokens_per_second")],
  start = 0,
  end = 30,
  window = "5m",
}: {
  status?: string;
  chartSeries?: PerformanceTrendSeries[];
  lines?: PerformanceTrendLine[];
  start?: number | null;
  end?: number | null;
  window?: "5m" | "1h" | "24h";
}) => (
  <EndpointPerformanceTrendChart
    ariaLabel="performance trend"
    end={end}
    lines={lines}
    series={chartSeries}
    start={start}
    status={status}
    window={window}
  />
);

describe("EndpointPerformanceTrendChart", () => {
  it("shows a loader while loading", () => {
    render(<Chart status="loading" />);
    screen.getByTitle("Loading...");
  });

  it.each([
    ["unavailable", series, "endpoints.performance.trendUnavailable"],
    ["ok", [], "endpoints.performance.noTrendData"],
  ])("explains a %s trend without data", (status, chartSeries, message) => {
    render(<Chart status={status} chartSeries={chartSeries} />);
    screen.getByRole("status");
    screen.getByText(message);
  });

  it("labels the chart and lists every line in the legend", () => {
    render(
      <Chart
        lines={[
          line("prompt_tokens_per_second", "left"),
          line("generation_tokens_per_second", "right"),
        ]}
      />,
    );
    screen.getByRole("img", { name: "performance trend" });
    screen.getByText("label:prompt_tokens_per_second");
    screen.getByText("label:generation_tokens_per_second");
  });

  it("keeps the selected window when data only covers its end", () => {
    const end = Date.UTC(2026, 0, 2, 12) / 1000;
    const start = end - 24 * 60 * 60;

    render(
      <Chart
        chartSeries={[
          {
            metric: "prompt_tokens_per_second",
            unit: "tokens_per_second",
            points: [{ timestamp: end - 60, value: 12 }],
          },
        ]}
        end={end}
        start={start}
        window="24h"
      />,
    );

    const chart = screen.getByRole("img", { name: "performance trend" });
    within(chart).getByText("01/01");
    within(chart).getAllByText("01/02");
  });
});
