import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SliderWithInput } from "./SliderWithInput";

// Radix Slider uses pointer events and ResizeObserver internally;
// stub them out so we can focus on the input / display logic.
vi.mock("@/components/ui/slider", () => ({
  Slider: () => <div data-testid="slider-stub" />,
}));

const getInputValue = () =>
  (screen.getByTestId("slider-input") as HTMLInputElement).value;

describe("SliderWithInput", () => {
  it("displays the value as-is when within [min, max]", () => {
    render(<SliderWithInput value={3} max={10} onChange={() => {}} />);
    expect(getInputValue()).toBe("3");
  });

  it("clamps displayed value to max when value exceeds max", () => {
    render(<SliderWithInput value={5} max={2} onChange={() => {}} />);
    expect(getInputValue()).toBe("2");
  });

  it("clamps displayed value to min when value is below min", () => {
    render(<SliderWithInput value={-1} min={0} max={10} onChange={() => {}} />);
    expect(getInputValue()).toBe("0");
  });

  it("remaining info never shows a negative number", () => {
    render(
      <SliderWithInput
        value={5}
        max={2}
        onChange={() => {}}
        remainingInfo={{ remaining: -3, total: 2, label: "Remaining" }}
      />,
    );
    expect(screen.getByText(/Remaining/).textContent).toBe(
      "Remaining: 0.0 / 2.0",
    );
  });

  it("remaining info displays correctly for positive remaining", () => {
    render(
      <SliderWithInput
        value={1}
        max={4}
        onChange={() => {}}
        remainingInfo={{ remaining: 3, total: 4, label: "Remaining" }}
      />,
    );
    expect(screen.getByText(/Remaining/).textContent).toBe(
      "Remaining: 3.0 / 4.0",
    );
  });

  it("clamps onChange output when user types a value exceeding max", () => {
    const onChange = vi.fn();
    render(<SliderWithInput value={1} max={5} onChange={onChange} />);

    fireEvent.change(screen.getByTestId("slider-input"), {
      target: { value: "10" },
    });
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("updates displayed value when max shrinks below current value", () => {
    const { rerender } = render(
      <SliderWithInput value={4} max={5} onChange={() => {}} />,
    );
    expect(getInputValue()).toBe("4");

    // Simulate max shrinking (e.g. switching to a node with fewer GPUs)
    rerender(<SliderWithInput value={4} max={2} onChange={() => {}} />);
    expect(getInputValue()).toBe("2");
  });
});
