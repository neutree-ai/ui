import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ExpandableCell, ExpandPanel } from "./ExpandableCell";

// jsdom has no portal layout; the panel body is what these cases care about.
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="expand-panel">{children}</div>
  ),
}));

const renderCell = (truncated: boolean) =>
  render(
    <ExpandableCell
      truncated={truncated}
      label="Show the full value of additional_config"
      panel={<ExpandPanel label="additional_config">{"{}"}</ExpandPanel>}
    >
      <code>{'{"a":1}'}</code>
    </ExpandableCell>,
  );

describe("ExpandableCell", () => {
  it("stays out of the way when the content is not cut off", () => {
    renderCell(false);

    // The control is the affordance, so its absence has to mean "there is
    // nothing more to see".
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText('{"a":1}')).toBeTruthy();
  });

  it("offers the control, named after the field, once the content is cut off", () => {
    renderCell(true);

    const control = screen.getByRole("button", {
      name: "Show the full value of additional_config",
    });
    expect(control).toBeTruthy();
    // A real button, so it takes a tab stop and opens with Enter or Space.
    expect(control.tagName).toBe("BUTTON");
    expect(screen.getByTestId("expand-panel").textContent).toContain(
      "additional_config",
    );
  });

  it("keeps the panel body the caller's own", () => {
    render(
      <ExpandableCell
        truncated
        label="Show the full description of rope_scaling"
        panel={
          <ExpandPanel label="rope_scaling" meta={<span>object</span>}>
            {"body"}
          </ExpandPanel>
        }
      >
        <span>clipped</span>
      </ExpandableCell>,
    );

    const panel = screen.getByTestId("expand-panel");
    expect(panel.textContent).toContain("rope_scaling");
    expect(panel.textContent).toContain("object");
    expect(panel.textContent).toContain("body");
  });
});
