import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VariantPicker } from "./VariantPicker";

describe("VariantPicker", () => {
  it("renders variants as a single-line segment control and emits the selected value", () => {
    const onChange = vi.fn();

    render(
      <VariantPicker
        variants={{
          default: {
            description: "Balanced latency and throughput.",
            vram_minimum_gb: 48,
          },
          throughput: {
            description: "Higher throughput for traffic simulation.",
            vram_minimum_gb: 80,
          },
        }}
        onChange={onChange}
        value="default"
      />,
    );

    screen.getByRole("group", { name: "endpoints.recipe.selectVariant" });

    const buttons = screen.getAllByRole("button");
    const defaultButton = buttons[0];
    const throughputButton = buttons[1];
    expect(defaultButton.getAttribute("aria-pressed")).toBe("true");
    expect(throughputButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(throughputButton);

    expect(onChange).toHaveBeenCalledWith("throughput");
  });
});
