import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl";

describe("SegmentedControl", () => {
  it("renders options as pressed buttons and emits selected value", () => {
    const onValueChange = vi.fn();

    render(
      <SegmentedControl
        ariaLabel="Monitor panel"
        value="overview"
        onValueChange={onValueChange}
        items={[
          { value: "overview", label: "Overview" },
          { value: "gpu", label: "Physical GPU" },
        ]}
      />,
    );

    expect(screen.getByRole("group", { name: "Monitor panel" })).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Overview" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Physical GPU" })
        .getAttribute("aria-pressed"),
    ).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Physical GPU" }));

    expect(onValueChange).toHaveBeenCalledWith("gpu");
  });

  it("exposes a description in the accessible label and keeps the option as a button", () => {
    render(
      <SegmentedControl
        ariaLabel="Monitor panel"
        value="overview"
        onValueChange={vi.fn()}
        items={[
          {
            value: "overview",
            label: "Overview",
            description: "Overview metrics",
          },
        ]}
      />,
    );

    const overview = screen.getByRole("button", {
      name: "Overview. Overview metrics",
    });
    expect(overview).toBeTruthy();
    expect(overview.getAttribute("aria-pressed")).toBe("true");
  });
});
