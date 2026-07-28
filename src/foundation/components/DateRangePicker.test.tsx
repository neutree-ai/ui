import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { days?: number }) => `${key}:${opts?.days}`,
  }),
}));

import { DateRangePicker, trailingRange } from "./DateRangePicker";

function openPicker(presets?: number[]) {
  const onChange = vi.fn();
  render(
    <DateRangePicker
      value={trailingRange(7)}
      onChange={onChange}
      presets={presets}
    />,
  );
  fireEvent.click(screen.getByRole("button"));
  return onChange;
}

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
    openPicker([7, 30]);

    expect(presetLabels()).toEqual([
      "common.dateRange.lastDays:7",
      "common.dateRange.lastDays:30",
    ]);
  });

  it("reports the trailing window when a quick pick is clicked", () => {
    const onChange = openPicker([7, 30]);

    fireEvent.click(screen.getByText("common.dateRange.lastDays:30"));

    expect(onChange).toHaveBeenCalledWith(trailingRange(30));
  });
});
