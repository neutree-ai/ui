import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { days?: number }) => `${key}:${opts?.days}`,
  }),
}));

import {
  type DateRange,
  DateRangePicker,
  trailingRange,
} from "./DateRangePicker";

// Renders the picker with its parent state wired up the way the real pages do
// it, then opens the popover. The default window is fixed so day clicks map to
// known dates; the trigger is always the first button on the page.
function openPicker({
  presets,
  value = { start: "2026-07-24", end: "2026-07-30" },
}: {
  presets?: number[];
  value?: DateRange;
} = {}) {
  const onChange = vi.fn();
  function Host() {
    const [range, setRange] = useState(value);
    return (
      <DateRangePicker
        value={range}
        presets={presets}
        onChange={(next) => {
          onChange(next);
          setRange(next);
        }}
      />
    );
  }
  render(<Host />);
  fireEvent.click(screen.getAllByRole("button")[0]);
  return onChange;
}

const reopenPicker = () => {
  fireEvent.click(screen.getAllByRole("button")[0]);
  fireEvent.click(screen.getAllByRole("button")[0]);
};

// Day cells are matched by their accessible label so that the leading/trailing
// days of the adjacent months don't collide with the July ones.
const clickDay = (day: number) =>
  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(`July ${day}\\w{2}, 2026`),
    }),
  );

const presetLabels = () =>
  screen
    .getAllByRole("button")
    .map((el) => el.textContent)
    .filter((text) => text?.startsWith("common.dateRange.lastDays"));

describe("DateRangePicker", () => {
  it("offers 7/30/90 day quick picks by default", () => {
    openPicker();

    expect(presetLabels()).toEqual([
      "common.dateRange.lastDays:7",
      "common.dateRange.lastDays:30",
      "common.dateRange.lastDays:90",
    ]);
  });

  it("only offers the quick picks the caller asks for", () => {
    openPicker({ presets: [7, 30] });

    expect(presetLabels()).toEqual([
      "common.dateRange.lastDays:7",
      "common.dateRange.lastDays:30",
    ]);
  });

  it("reports the trailing window when a quick pick is clicked", () => {
    const onChange = openPicker({ presets: [7, 30] });

    fireEvent.click(screen.getByText("common.dateRange.lastDays:30"));

    expect(onChange).toHaveBeenCalledWith(trailingRange(30));
  });

  // Two clicks always define the whole range: the first only anchors a start,
  // so the committed window is never extended from the previous one.
  it.each([
    {
      name: "starts a new range instead of extending the current one",
      clicks: [25, 28],
      committed: { start: "2026-07-25", end: "2026-07-28" },
    },
    {
      name: "normalises a backwards selection",
      clicks: [28, 25],
      committed: { start: "2026-07-25", end: "2026-07-28" },
    },
    {
      name: "selects a single day when the same day is picked twice",
      clicks: [26, 26],
      committed: { start: "2026-07-26", end: "2026-07-26" },
    },
  ])("$name", ({ clicks: [first, second], committed }) => {
    const onChange = openPicker();

    clickDay(first);
    expect(onChange).not.toHaveBeenCalled();

    clickDay(second);
    expect(onChange).toHaveBeenCalledWith(committed);
  });

  it("discards a half-finished range when the popover is reopened", () => {
    const onChange = openPicker();

    clickDay(25);
    reopenPicker();
    clickDay(28);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("drops a half-finished range when a quick pick is used", () => {
    const onChange = openPicker();

    clickDay(25);
    fireEvent.click(screen.getByText("common.dateRange.lastDays:7"));

    expect(onChange).toHaveBeenCalledWith(trailingRange(7));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
