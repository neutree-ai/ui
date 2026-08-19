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
    expect(screen.getByText("Production calls").className).toContain("text-xs");
    expect(screen.getByText("Production calls").className).toContain(
      "text-muted-foreground",
    );
    expect(screen.queryByText("apikey-technical")).toBeNull();
  });

  it("falls back to the technical name and omits an empty description", () => {
    const { container } = render(
      <ApiKeyLabel name="apikey-technical" description="" />,
    );

    expect(screen.getByText("apikey-technical")).toBeTruthy();
    expect(container.querySelectorAll("div")).toHaveLength(2);
  });
});
