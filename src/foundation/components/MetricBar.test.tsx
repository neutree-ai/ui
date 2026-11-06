import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { METRIC_BAR_SERIES_FILL_CLASSES, MetricBar } from "./MetricBar";

describe("MetricBar", () => {
  it("maps series names to the approved categorical tokens", () => {
    expect(METRIC_BAR_SERIES_FILL_CLASSES.blue).toContain(
      "--nt-chart-series-1",
    );
    expect(METRIC_BAR_SERIES_FILL_CLASSES.orange).toContain(
      "--nt-chart-series-2",
    );
    expect(METRIC_BAR_SERIES_FILL_CLASSES.cyan).toContain(
      "--nt-chart-series-3",
    );
    expect(METRIC_BAR_SERIES_FILL_CLASSES.red).toContain("--nt-chart-series-4");
    expect(METRIC_BAR_SERIES_FILL_CLASSES.teal).toContain(
      "--nt-chart-series-5",
    );
    expect(METRIC_BAR_SERIES_FILL_CLASSES.magenta).toContain(
      "--nt-chart-series-6",
    );
    expect(METRIC_BAR_SERIES_FILL_CLASSES.gold).toContain(
      "--nt-chart-series-7",
    );
    expect(METRIC_BAR_SERIES_FILL_CLASSES.violet).toContain(
      "--nt-chart-series-8",
    );
    expect(METRIC_BAR_SERIES_FILL_CLASSES.neutral).toContain("--nt-chart-more");
  });

  it.each([
    { value: 42, track: undefined, shown: "42" },
    { value: 120, track: undefined, shown: "100" },
    { value: 50, track: "unavailable" as const, shown: "0" },
  ])(
    "reports $value on a $track track as $shown",
    ({ value, track, shown }) => {
      render(
        <MetricBar data-testid="metric-bar" value={value} track={track} />,
      );

      expect(
        screen.getByTestId("metric-bar").getAttribute("aria-valuenow"),
      ).toBe(shown);
    },
  );
});
