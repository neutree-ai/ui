import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InfoHint, skipInfoHintOnOpen } from "./InfoHint";
import { Section } from "./Section";

describe("InfoHint", () => {
  it("puts a section's hint behind a button beside the title", () => {
    render(
      <Section title="Policies" hint="Every member holds these roles.">
        body
      </Section>,
    );

    const heading = screen.getByRole("heading", { name: /Policies/ });
    expect(
      screen.getByRole("button", { name: "Every member holds these roles." }),
    ).toBeTruthy();
    expect(heading.textContent).toBe("Policies");
    expect(screen.queryByText("Every member holds these roles.")).toBeNull();
  });

  it("skips the hint when a dialog opens", () => {
    render(
      <Dialog open>
        <DialogContent
          aria-describedby={undefined}
          onOpenAutoFocus={skipInfoHintOnOpen}
        >
          <DialogHeader>
            <DialogTitle>
              Create
              <InfoHint label="What this creates." />
            </DialogTitle>
          </DialogHeader>
          <input aria-label="Name" />
        </DialogContent>
      </Dialog>,
    );

    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
  });
});
