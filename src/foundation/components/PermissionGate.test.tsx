import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/foundation/hooks/use-has-permission", () => ({
  useHasPermission: vi.fn(),
}));

import { useHasPermission } from "@/foundation/hooks/use-has-permission";
import { PermissionGate } from "./PermissionGate";

const gate = () =>
  render(
    <PermissionGate permission="identity_source:read">
      <div>secret page</div>
    </PermissionGate>,
  );

describe("PermissionGate", () => {
  it("renders the page for a permitted user", () => {
    vi.mocked(useHasPermission).mockReturnValue({
      allowed: true,
      isLoading: false,
    });
    gate();
    expect(screen.getByText("secret page")).toBeTruthy();
  });

  it("shows the no-permission state otherwise", () => {
    vi.mocked(useHasPermission).mockReturnValue({
      allowed: false,
      isLoading: false,
    });
    gate();
    expect(screen.queryByText("secret page")).toBeNull();
    expect(screen.getByTestId("no-permission").textContent).toBe(
      "common.messages.noPermission",
    );
  });

  it("renders nothing of the page while checking", () => {
    vi.mocked(useHasPermission).mockReturnValue({
      allowed: undefined,
      isLoading: true,
    });
    gate();
    expect(screen.queryByText("secret page")).toBeNull();
    expect(screen.queryByTestId("no-permission")).toBeNull();
  });
});
