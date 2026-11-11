import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InfoHint } from "./InfoHint";
import { Section } from "./Section";

describe("InfoHint", () => {
  it("puts a section's hint behind a button beside the title", () => {
    render(
      <Section title="Policies" hint="Every member holds these roles.">
        body
      </Section>,
    );

    screen.getByRole("heading", { name: "Policies" });
    screen.getByRole("button", { name: "Every member holds these roles." });
    expect(screen.queryByText("Every member holds these roles.")).toBeNull();
  });

  it("names a dialog by its title and describes it by its hint", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle hint="What this creates.">Create</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Create" });
    expect(screen.getByRole("heading", { name: "Create" }).textContent).toBe(
      "Create",
    );
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(
      describedBy && document.getElementById(describedBy)?.textContent,
    ).toBe("What this creates.");
  });

  it("focuses a dialog's first field on open, not its hint", () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle hint="What this creates.">Create</DialogTitle>
          </DialogHeader>
          <input aria-label="Name" />
        </DialogContent>
      </Dialog>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("keeps the tooltip closed on focus that is not from the keyboard", () => {
    render(<InfoHint label="Why this matters." />);
    const hint = screen.getByRole("button", { name: "Why this matters." });
    // jsdom's :focus-visible heuristic depends on earlier tests' focus, so
    // pin the answer a mouse-driven focus gets in a browser.
    vi.spyOn(hint, "matches").mockReturnValue(false);

    act(() => hint.focus());

    expect(document.activeElement).toBe(hint);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens the tooltip on keyboard focus", () => {
    render(
      <>
        <input aria-label="Before" />
        <InfoHint label="Why this matters." />
      </>,
    );

    const before = screen.getByLabelText("Before");
    const hint = screen.getByRole("button", { name: "Why this matters." });
    act(() => before.focus());
    fireEvent.keyDown(before, { key: "Tab" });
    act(() => hint.focus());
    fireEvent.keyUp(hint, { key: "Tab" });

    expect(screen.getByRole("tooltip").textContent).toContain(
      "Why this matters.",
    );
  });
});
