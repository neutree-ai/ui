import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MaxLengthSelector } from "./MaxLengthSelector";
import { TemperatureSelector } from "./TemperatureSelector";
import { TopPSelector } from "./TopPSelector";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Radix Slider needs pointer events / ResizeObserver; stub it out and expose
// the min/max it was handed so we can assert each wrapper's range wiring.
vi.mock("@/components/ui/slider", () => ({
  Slider: ({ min, max }: { min: number; max: number }) => (
    <div data-testid="slider-stub" data-min={min} data-max={max} />
  ),
}));

const getRange = () => {
  const stub = screen.getByTestId("slider-stub");
  return {
    min: stub.getAttribute("data-min"),
    max: stub.getAttribute("data-max"),
  };
};

describe("TemperatureSelector", () => {
  it("wires the 0..1 range and clamps typed input", () => {
    const onChange = vi.fn();
    render(<TemperatureSelector value={0.5} onChange={onChange} />);

    expect(getRange()).toEqual({ min: "0", max: "1" });
    fireEvent.change(
      screen.getByLabelText("components.playground.chat.temperature"),
      { target: { value: "5" } },
    );
    expect(onChange).toHaveBeenCalledWith(1);
  });
});

describe("TopPSelector", () => {
  it("wires the 0..1 range and clamps typed input", () => {
    const onChange = vi.fn();
    render(<TopPSelector value={0.5} onChange={onChange} />);

    expect(getRange()).toEqual({ min: "0", max: "1" });
    fireEvent.change(screen.getByLabelText("components.playground.chat.topP"), {
      target: { value: "-1" },
    });
    expect(onChange).toHaveBeenCalledWith(0);
  });
});

describe("MaxLengthSelector", () => {
  it("wires the 1KiB..1MiB range and clamps typed input", () => {
    const onChange = vi.fn();
    render(<MaxLengthSelector value={64 * 1024} onChange={onChange} />);

    expect(getRange()).toEqual({ min: "1024", max: "1048576" });
    fireEvent.change(
      screen.getByLabelText("components.playground.chat.maximumLength"),
      { target: { value: "0" } },
    );
    expect(onChange).toHaveBeenCalledWith(1024);
  });

  it("renders the humanized value preview", () => {
    render(<MaxLengthSelector value={64 * 1024} onChange={() => {}} />);
    expect(screen.getByText("64K")).toBeTruthy();
  });
});
