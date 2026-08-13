import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VariantPicker } from "./VariantPicker";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === "endpoints.recipe.selectVariant" ? "Select a variant" : key,
  }),
}));

describe("VariantPicker", () => {
  it("renders variants as radio options and emits the selected value", () => {
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

    expect(
      screen.getByRole("radiogroup", { name: "Select a variant" }),
    ).toBeTruthy();

    const radios = screen.getAllByRole("radio");
    const defaultRadio = radios[0];
    const throughputRadio = radios[1];
    expect((defaultRadio as HTMLInputElement).checked).toBe(true);
    expect((throughputRadio as HTMLInputElement).checked).toBe(false);

    fireEvent.click(throughputRadio);

    expect(onChange).toHaveBeenCalledWith("throughput");
  });
});
