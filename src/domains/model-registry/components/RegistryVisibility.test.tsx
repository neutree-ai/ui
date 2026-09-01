import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RegistryVisibility } from "./RegistryVisibility";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("RegistryVisibility", () => {
  it("aligns the icon and value with surrounding metadata", () => {
    render(<RegistryVisibility visibility="public" />);

    const value = screen.getByTestId("registry-visibility-public");
    expect(value.className).toContain("items-center");
    expect(value.className).toContain("align-middle");
  });

  it("renders an unknown visibility without inventing a value", () => {
    render(<RegistryVisibility visibility={undefined} />);

    expect(screen.getByText("-").className).toContain("text-muted-foreground");
  });
});
