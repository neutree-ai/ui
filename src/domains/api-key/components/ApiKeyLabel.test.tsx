import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiKeyLabel } from "./ApiKeyLabel";

describe("ApiKeyLabel", () => {
  it("shows the display name and description instead of the technical name", () => {
    render(
      <ApiKeyLabel
        name="apikey-technical"
        displayName="Customer support"
        description="Production calls"
      />,
    );

    screen.getByText("Customer support");
    screen.getByText("Production calls");
    expect(screen.queryByText("apikey-technical")).toBeNull();
  });

  it("falls back to the technical name", () => {
    render(<ApiKeyLabel name="apikey-technical" description="" />);

    screen.getByText("apikey-technical");
  });

  it("leaves the description out of the inline variant", () => {
    render(
      <ApiKeyLabel
        variant="inline"
        name="apikey-technical"
        description="Production calls"
      />,
    );

    screen.getByText("apikey-technical");
    expect(screen.queryByText("Production calls")).toBeNull();
  });
});
