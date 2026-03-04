import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NumberInput } from "./NumberInput";

const getInput = () => screen.getByRole("spinbutton") as HTMLInputElement;

describe("NumberInput", () => {
  it("displays the external value when not editing", () => {
    render(<NumberInput value={42} />);
    expect(getInput().value).toBe("42");
  });

  it("calls onValueChange with parsed number on valid input", () => {
    const onValueChange = vi.fn();
    render(<NumberInput value={0} onValueChange={onValueChange} />);

    fireEvent.focus(getInput());
    fireEvent.change(getInput(), { target: { value: "123" } });
    expect(onValueChange).toHaveBeenCalledWith(123);
  });

  it("allows clearing the input to empty without calling onValueChange", () => {
    const onValueChange = vi.fn();
    render(<NumberInput value={10} onValueChange={onValueChange} />);

    fireEvent.focus(getInput());
    fireEvent.change(getInput(), { target: { value: "" } });
    expect(getInput().value).toBe("");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("snaps back to display value on blur after empty input", () => {
    render(<NumberInput value={10} />);

    fireEvent.focus(getInput());
    fireEvent.change(getInput(), { target: { value: "" } });
    expect(getInput().value).toBe("");

    fireEvent.blur(getInput());
    expect(getInput().value).toBe("10");
  });

  it("calls onInvalidBlur when blurring with empty input", () => {
    const onInvalidBlur = vi.fn();
    render(<NumberInput value={10} onInvalidBlur={onInvalidBlur} />);

    fireEvent.focus(getInput());
    fireEvent.change(getInput(), { target: { value: "" } });
    fireEvent.blur(getInput());
    expect(onInvalidBlur).toHaveBeenCalledOnce();
  });

  it("does not call onInvalidBlur when blurring with valid input", () => {
    const onInvalidBlur = vi.fn();
    render(<NumberInput value={10} onInvalidBlur={onInvalidBlur} />);

    fireEvent.focus(getInput());
    fireEvent.change(getInput(), { target: { value: "5" } });
    fireEvent.blur(getInput());
    expect(onInvalidBlur).not.toHaveBeenCalled();
  });

  it("allows typing leading zeros while editing", () => {
    render(<NumberInput value={1} />);

    fireEvent.focus(getInput());
    fireEvent.change(getInput(), { target: { value: "01" } });
    expect(getInput().value).toBe("01");
  });

  it("reflects external value updates when not editing", () => {
    const { rerender } = render(<NumberInput value={5} />);
    expect(getInput().value).toBe("5");

    rerender(<NumberInput value={20} />);
    expect(getInput().value).toBe("20");
  });

  it("keeps draft during editing even if external value changes", () => {
    const { rerender } = render(<NumberInput value={5} />);

    fireEvent.focus(getInput());
    fireEvent.change(getInput(), { target: { value: "99" } });

    rerender(<NumberInput value={10} />);
    // Still shows the user's draft, not the new external value
    expect(getInput().value).toBe("99");
  });

  it("passes through standard input props", () => {
    render(
      <NumberInput
        value={0}
        min={0}
        max={100}
        placeholder="enter a number"
        disabled
      />,
    );
    const input = getInput();
    expect(input.min).toBe("0");
    expect(input.max).toBe("100");
    expect(input.placeholder).toBe("enter a number");
    expect(input.disabled).toBe(true);
  });
});
