import { render, screen } from "@testing-library/react";
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
}: {
  status?: string;
  chartSeries?: PerformanceTrendSeries[];
  lines?: PerformanceTrendLine[];
}) => (
  <EndpointPerformanceTrendChart
    ariaLabel="performance trend"
    lines={lines}
    series={chartSeries}
    status={status}
    window="5m"
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
});
