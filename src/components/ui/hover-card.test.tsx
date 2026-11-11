import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "./hover-card";

describe("HoverCardContent", () => {
  it("portals outside overflow-clipped parents", () => {
    render(
      <div data-testid="clipped-parent" className="overflow-hidden">
        <HoverCard open>
          <HoverCardTrigger>Trigger</HoverCardTrigger>
          <HoverCardContent>Complete content</HoverCardContent>
        </HoverCard>
      </div>,
    );

    expect(
      screen
        .getByTestId("clipped-parent")
        .contains(screen.getByText("Complete content")),
    ).toBe(false);
  });
});
