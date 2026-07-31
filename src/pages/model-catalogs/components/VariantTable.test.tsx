import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VariantTable } from "./VariantTable";

const variants = {
  default: {
    description: "Balanced demos",
    resources: { gpu: 1, cpu: 8, memory: 32, accelerator: null },
    vram_minimum_gb: 48,
  },
  throughput: {
    description: "Traffic simulation",
    resources: { gpu: 1, cpu: 16, memory: 64, accelerator: null },
    vram_minimum_gb: 80,
  },
};

describe("VariantTable", () => {
  it("renders profile rows as radio options and emits selection", () => {
    const onSelect = vi.fn();

    render(
      <VariantTable
        variants={variants}
        selectedVariant="throughput"
        onSelect={onSelect}
      />,
    );

    expect(screen.getByTestId("variant-selector-table")).toBeTruthy();
    expect(
      (screen.getByLabelText("Select throughput profile") as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(screen.getByText("1 GPU · 16 CPU · 64 GiB")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Select default profile"));

    expect(onSelect).toHaveBeenCalledWith("default");
  });
});
