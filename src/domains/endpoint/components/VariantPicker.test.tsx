import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VariantPicker } from "./VariantPicker";

describe("VariantPicker", () => {
  it("offers variants as a radio group and emits the selected value", () => {
    const onChange = vi.fn();

    render(
      <VariantPicker
        variants={{
          default: {
            model: {
              registry: "default-source",
              name: "qwen3.6-27b",
              version: "",
              file: "",
              task: "text-generation",
            },
          },
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
    screen.getByText("default-source");
    screen.getByText("huggingface");
    screen.getByLabelText("endpoints.recipe.defaultVariant");
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
