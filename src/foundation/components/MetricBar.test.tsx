import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricBar } from "./MetricBar";

describe("MetricBar", () => {
  it("keeps the track caps rounded and the progress end flat by default", () => {
    render(<MetricBar data-testid="metric-bar" value={42} series="green" />);

    const bar = screen.getByTestId("metric-bar");
    expect(bar.className).toContain("rounded-full");
    expect(bar.className).toContain("[&>div]:rounded-none");
    expect(bar.className).toContain("--nt-chart-series-4");
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
  });

  it("supports rounded, square, compact, outlined and unavailable variants", () => {
    const { rerender } = render(
      <MetricBar
        data-testid="metric-bar"
        value={120}
        size="sm"
        shape="rounded"
        series="neutral"
        track="outlined"
      />,
    );

    const bar = screen.getByTestId("metric-bar");
    expect(bar.className).toContain("h-1.5");
    expect(bar.className).toContain("rounded-full");
    expect(bar.className).toContain("--nt-fill-neutral-trans-7");
    expect(bar.className).toContain(
      "border-[var(--nt-stroke-neutral-trans-3)]",
    );
    expect(bar.getAttribute("aria-valuenow")).toBe("100");

    rerender(<MetricBar data-testid="metric-bar" value={50} shape="square" />);
    expect(bar.className).toContain("rounded-none");

    rerender(
      <MetricBar data-testid="metric-bar" value={50} track="unavailable" />,
    );
    expect(bar.className).toContain("border-dashed");
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
  });
});
