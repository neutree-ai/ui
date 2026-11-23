import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricBar } from "./MetricBar";

describe("MetricBar", () => {
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
