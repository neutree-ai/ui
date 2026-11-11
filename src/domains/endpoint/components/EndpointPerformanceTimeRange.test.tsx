import { fireEvent, render, screen } from "@testing-library/react";
import dayjs from "dayjs";
import { describe, expect, it, vi } from "vitest";
import type { PerformanceTimeRange } from "@/domains/endpoint/hooks/use-endpoint-performance-trends";
import { EndpointPerformanceTimeRange } from "./EndpointPerformanceTimeRange";

const preset: PerformanceTimeRange = { kind: "preset", window: "1h" };
const custom: PerformanceTimeRange = {
  kind: "custom",
  start: Date.UTC(2026, 0, 2, 2, 0, 0) / 1000,
  end: Date.UTC(2026, 0, 2, 3, 0, 0) / 1000,
};

describe("EndpointPerformanceTimeRange", () => {
  it("opens a custom range seeded from the current preset and can be dismissed", () => {
    render(<EndpointPerformanceTimeRange value={preset} onChange={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "endpoints.performance.customRange",
      }),
    );
    expect(
      (
        screen.getByLabelText(
          "endpoints.performance.startTime",
        ) as HTMLInputElement
      ).value,
    ).not.toBe("");
    fireEvent.click(screen.getByRole("button", { name: "buttons.cancel" }));

    expect(
      screen.queryByText("endpoints.performance.customRangeTitle"),
    ).toBeNull();
  });

  it("reopens with the applied custom range", () => {
    const view = render(
      <EndpointPerformanceTimeRange value={preset} onChange={vi.fn()} />,
    );
    view.rerender(
      <EndpointPerformanceTimeRange value={custom} onChange={vi.fn()} />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: `${dayjs.unix(custom.start).format("MMM D HH:mm")} – ${dayjs
          .unix(custom.end)
          .format("MMM D HH:mm")}`,
      }),
    );

    expect(
      screen.getByLabelText("endpoints.performance.startTime"),
    ).toHaveProperty(
      "value",
      dayjs.unix(custom.start).format("YYYY-MM-DDTHH:mm"),
    );
    expect(
      screen.getByLabelText("endpoints.performance.endTime"),
    ).toHaveProperty(
      "value",
      dayjs.unix(custom.end).format("YYYY-MM-DDTHH:mm"),
    );
  });
});
