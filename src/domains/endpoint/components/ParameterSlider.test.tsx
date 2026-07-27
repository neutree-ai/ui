import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ParameterSlider } from "./ParameterSlider";

// Radix Slider uses pointer events and ResizeObserver internally; stub it out
// with a button that replays the drag callback so we can drive it from tests.
vi.mock("@/components/ui/slider", () => ({
  Slider: ({
    onValueChange,
    max,
  }: {
    onValueChange: (v: number[]) => void;
    max: number;
  }) => (
    <button
      type="button"
      data-testid="slider-stub"
      onClick={() => onValueChange([max])}
    />
  ),
}));

const renderSlider = (
  props: Partial<React.ComponentProps<typeof ParameterSlider>> = {},
) => {
  const onChange = vi.fn();
  render(
    <ParameterSlider
      id="temperature"
      label="Temperature"
      description="Controls randomness"
      max={1}
      step={0.1}
      value={0.5}
      onChange={onChange}
      {...props}
    />,
  );
  return {
    onChange,
    input: screen.getByLabelText("Temperature") as HTMLInputElement,
  };
};

describe("ParameterSlider", () => {
  it("passes through an in-range value unchanged", () => {
    const { onChange, input } = renderSlider();
    fireEvent.change(input, { target: { value: "0.3" } });
    expect(onChange).toHaveBeenCalledWith(0.3);
  });

  it("clamps input above max down to max", () => {
    const { onChange, input } = renderSlider({ max: 1 });
    fireEvent.change(input, { target: { value: "10" } });
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("clamps input below min up to min", () => {
    const { onChange, input } = renderSlider({ min: 0 });
    fireEvent.change(input, { target: { value: "-5" } });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("clamps against a non-zero min", () => {
    const { onChange, input } = renderSlider({ min: 1024, max: 1024 * 1024 });
    fireEvent.change(input, { target: { value: "0" } });
    expect(onChange).toHaveBeenCalledWith(1024);
  });

  it("forwards slider drags through onChange", () => {
    const { onChange } = renderSlider({ max: 1 });
    fireEvent.click(screen.getByTestId("slider-stub"));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("renders an optional value preview", () => {
    renderSlider({
      valuePreview: <span>64K</span>,
    });
    expect(screen.getByText("64K")).toBeTruthy();
  });
});
