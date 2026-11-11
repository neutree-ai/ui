import { render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PerformanceTrendSeries,
  PerformanceWindow,
} from "@/domains/endpoint/hooks/use-endpoint-performance-trends";
import {
  EndpointPerformanceTrendChart,
  type PerformanceTrendLine,
} from "./EndpointPerformanceTrendChart";

const chart = vi.hoisted(() => ({
  tooltipProps: {} as Record<string, unknown>,
  yAxisValues: [0.25, 2] as number[],
}));

vi.mock("recharts", async () => {
  const { cloneElement, isValidElement } = await import("react");
  const passthrough = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );

  return {
    CartesianGrid: () => null,
    Line: () => null,
    LineChart: passthrough,
    ResponsiveContainer: passthrough,
    Tooltip: ({ content }: { content?: ReactNode }) =>
      isValidElement(content)
        ? cloneElement(
            content as ReactElement<Record<string, unknown>>,
            chart.tooltipProps,
          )
        : null,
    XAxis: () => null,
    YAxis: ({
      yAxisId,
      tickFormatter,
    }: {
      yAxisId?: string;
      tickFormatter?: (value: number) => string;
    }) => (
      <div data-testid={`y-axis-${yAxisId}`}>
        {tickFormatter
          ? chart.yAxisValues.map((value) => (
              <span key={value}>{tickFormatter(value)}</span>
            ))
          : null}
      </div>
    ),
  };
});

const series: PerformanceTrendSeries[] = [
  {
    metric: "prompt_tokens_per_second",
    unit: "tokens_per_second",
    points: [
      { timestamp: 10, value: 100 },
      { timestamp: 20, value: 120 },
      { timestamp: 30, value: 110 },
    ],
  },
  {
    metric: "generation_tokens_per_second",
    unit: "tokens_per_second",
    points: [{ timestamp: 10, value: 30 }],
  },
];

const line = (
  overrides: Partial<PerformanceTrendLine> &
    Pick<PerformanceTrendLine, "metric">,
): PerformanceTrendLine => ({
  label: overrides.metric,
  formatValue: (value) => `value:${value}`,
  ...overrides,
});

function Chart({
  lines = [
    line({
      metric: "prompt_tokens_per_second",
      axis: "left",
      formatAxisValue: (value) => `axis:${value}`,
    }),
  ],
  status = "ok",
  window = "5m",
  chartSeries = series,
}: {
  lines?: PerformanceTrendLine[];
  status?: string;
  window?: PerformanceWindow;
  chartSeries?: PerformanceTrendSeries[];
}) {
  return (
    <EndpointPerformanceTrendChart
      ariaLabel="performance trend"
      lines={lines}
      series={chartSeries}
      status={status}
      window={window}
    />
  );
}

describe("EndpointPerformanceTrendChart", () => {
  beforeEach(() => {
    chart.tooltipProps = {};
    chart.yAxisValues = [0.25, 2];
  });

  it("shows loading separately from unavailable and empty trends", () => {
    const loading = render(<Chart status="loading" />);
    expect(screen.queryByRole("status")).toBeNull();
    loading.unmount();

    render(<Chart status="unavailable" />);
    screen.getByText("endpoints.performance.trendUnavailable");
    screen.getByRole("status");
  });

  it("shows the empty-data message when the trend request succeeded", () => {
    render(<Chart chartSeries={[]} />);
    screen.getByText("endpoints.performance.noTrendData");
  });

  it("uses the configured formatter for a left axis", () => {
    chart.tooltipProps = {
      active: true,
      label: 43200,
      payload: [{ dataKey: "prompt_tokens_per_second", value: 100 }],
    };
    render(<Chart />);

    screen.getByTestId("y-axis-left");
    screen.getByText("axis:0.25");
    screen.getByText("axis:2");
    screen.getByText("12:00:00");
  });

  it("falls back to the value formatter for a right-only axis", () => {
    render(
      <Chart
        lines={[
          line({
            metric: "generation_tokens_per_second",
            axis: "right",
          }),
        ]}
      />,
    );

    screen.getByTestId("y-axis-right");
    screen.getByText("value:0.25");
    screen.getByText("value:2");
  });

  it("renders split latency axes and their tooltip", () => {
    chart.tooltipProps = {
      active: true,
      label: 43200,
      payload: [
        { dataKey: "prompt_tokens_per_second", value: 100 },
        { dataKey: "generation_tokens_per_second", value: 30 },
      ],
    };
    render(
      <Chart
        lines={[
          line({
            metric: "prompt_tokens_per_second",
            axis: "left",
            formatAxisValue: (value) => `left:${value}`,
          }),
          line({
            metric: "generation_tokens_per_second",
            axis: "right",
            formatAxisValue: (value) => `right:${value}`,
          }),
        ]}
      />,
    );

    screen.getByText("left:0.25");
    screen.getByText("right:2");
    screen.getAllByText("12:00:00");
    screen.getAllByText("prompt_tokens_per_second");
    screen.getByText("value:100");
    screen.getAllByText("generation_tokens_per_second");
    screen.getByText("value:30");
  });

  it("keeps tooltip rendering quiet until a complete active row exists", () => {
    const view = render(<Chart />);

    chart.tooltipProps = { active: false, label: 43200, payload: [] };
    view.rerender(<Chart />);
    expect(screen.queryByText("12:00:00")).toBeNull();

    chart.tooltipProps = { active: true, label: 43200, payload: [] };
    view.rerender(<Chart />);
    expect(screen.queryByText("12:00:00")).toBeNull();

    chart.tooltipProps = {
      active: true,
      label: null,
      payload: [{ dataKey: "prompt_tokens_per_second", value: 100 }],
    };
    view.rerender(<Chart />);
    expect(screen.queryByText("12:00:00")).toBeNull();
  });

  it("filters invalid payload rows and skips lines without a measurement", () => {
    chart.tooltipProps = {
      active: true,
      label: 43200,
      payload: [
        { dataKey: "prompt_tokens_per_second", value: 100 },
        { dataKey: 3, value: 12 },
        { dataKey: "generation_tokens_per_second" },
      ],
    };
    render(
      <Chart
        lines={[
          line({
            metric: "prompt_tokens_per_second",
            dashed: true,
            formatValue: (value) => `dashed:${value}`,
          }),
          line({
            metric: "generation_tokens_per_second",
            formatValue: (value) => `solid:${value}`,
          }),
        ]}
      />,
    );

    screen.getByText("12:00:00");
    screen.getAllByText("prompt_tokens_per_second");
    screen.getByText("dashed:100");
    expect(screen.queryByText(/solid:/)).toBeNull();
  });
});
