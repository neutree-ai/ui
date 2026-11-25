import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import { ApiKeyLabel } from "./ApiKeyLabel";

describe("ApiKeyLabel", () => {
  it("shows the display name with the technical name and description under it", () => {
    render(
      <ApiKeyLabel
        name="apikey-technical"
        displayName="Customer support"
        description="Production calls"
      />,
    );

    screen.getByText("Customer support");
    screen.getByText("apikey-technical");
    screen.getByText("Production calls");
  });

  it("falls back to the technical name and leaves out an empty description", () => {
    render(<ApiKeyLabel name="apikey-technical" description="" />);

    expect(screen.getAllByText("apikey-technical")).toHaveLength(1);
  });

  it("keeps the inline variant to the name, with the rest on a tooltip", async () => {
    vi.mocked(useIsTruncated).mockReturnValue(true);
    render(
      <ApiKeyLabel
        variant="inline"
        name="apikey-technical"
        displayName="Support"
        description="Production calls"
      />,
    );

    screen.getByText("Support");
    expect(screen.queryByText("apikey-technical")).toBeNull();
    screen.getByText("Support").focus();
    const tip = await screen.findByRole("tooltip");
    expect(tip.textContent).toContain("api_keys.label.technicalName");
    expect(tip.textContent).toContain("Production calls");
  });
});
