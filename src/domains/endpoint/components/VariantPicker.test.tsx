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

  it("renders a native radio group for the wizard variant field", () => {
    const onChange = vi.fn();

    render(
      <VariantPicker
        layout="radio"
        variants={{
          bf16: {
            model: {
              registry: "model-nfs",
              name: "qwen3.6-27b",
              version: "",
              file: "",
              task: "text-generation",
            },
            vram_minimum_gb: 54,
          },
          fp8: {
            model: {
              registry: "huggingface",
              name: "Qwen/Qwen3.6-27B-FP8",
              version: "",
              file: "",
              task: "text-generation",
            },
            vram_minimum_gb: 27,
          },
        }}
        onChange={onChange}
        value="bf16"
      />,
    );

    screen.getByText("model-nfs");
    screen.getByText("huggingface");
    screen.getByRole("radiogroup", {
      name: "endpoints.recipe.selectVariant",
    });
    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: "bf16" }).checked,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: "fp8" }).checked,
    ).toBe(false);

    fireEvent.click(screen.getByRole("radio", { name: "fp8" }));
    expect(onChange).toHaveBeenCalledWith("fp8");
  });
});
