import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiKeyLabel } from "./ApiKeyLabel";

describe("ApiKeyLabel", () => {
  it("shows the display name and description", () => {
    render(
      <ApiKeyLabel
        name="apikey-technical"
        displayName="Customer support"
        description="Production calls"
      />,
    );

    expect(screen.getByText("Customer support")).toBeTruthy();
    expect(screen.getByText("Customer support").className).toContain("text-sm");
    expect(screen.getByText("Production calls").className).toContain(
      "text-[10px]",
    );
    expect(screen.getByText("Production calls").className).toContain(
      "text-muted-foreground",
    );
    expect(screen.queryByText("apikey-technical")).toBeNull();
  });

  it("gives the description its own line box", () => {
    render(
      <ApiKeyLabel name="apikey-technical" description="Production calls" />,
    );

    // At 10px the description would otherwise inherit the name's 20px line box,
    // which reads as a gap between the two lines and pushes the block out of any
    // control sized for one line.
    expect(screen.getByText("Production calls").className).toContain(
      "leading-4",
    );
  });

  it("falls back to the technical name and omits an empty description", () => {
    const { container } = render(
      <ApiKeyLabel name="apikey-technical" description="" />,
    );

    expect(screen.getByText("apikey-technical")).toBeTruthy();
    expect(container.querySelectorAll("div")).toHaveLength(2);
  });

  it("renders one line, without the description, where it sits inside a control", () => {
    render(
      <ApiKeyLabel
        variant="inline"
        name="apikey-technical"
        description="Production calls"
      />,
    );

    const label = screen.getByText("apikey-technical");
    expect(label.tagName).toBe("SPAN");
    expect(label.className).toContain("truncate");
    // The description belongs to the open list, not to the closed control.
    expect(screen.queryByText("Production calls")).toBeNull();
  });
});
