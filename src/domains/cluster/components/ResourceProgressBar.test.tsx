import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResourceProgressBar } from "./ResourceProgressBar";

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: { value: number }) => (
    <div data-testid="progress" data-value={value} />
  ),
}));

describe("ResourceProgressBar", () => {
  it("renders the CPU unit abbreviation", () => {
    render(<ResourceProgressBar label="CPU" used={4} total={16} unit="c" />);

    expect(screen.getByText("4.0 / 16.0 c (25%)")).toBeTruthy();
  });
});
