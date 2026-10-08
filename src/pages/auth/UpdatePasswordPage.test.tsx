import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@refinedev/core", () => ({
  useActiveAuthProvider: () => ({}),
  useUpdatePassword: () => ({ mutate: vi.fn(), isLoading: false }),
  useGetIdentity: vi.fn(() => ({ data: { external: false } })),
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("./ThemedTitle", () => ({ ThemedTitle: () => null }));

import { useGetIdentity } from "@refinedev/core";
import { UpdatePasswordPage } from "./UpdatePasswordPage";

describe("UpdatePasswordPage", () => {
  it("lets a local user change the password", () => {
    render(<UpdatePasswordPage />);

    expect(document.querySelector('input[name="password"]')).not.toBeNull();
    expect(screen.queryByTestId("external-password-hint")).toBeNull();
  });

  it("explains instead of offering a form to an external user", () => {
    vi.mocked(useGetIdentity).mockReturnValue({
      data: { external: true },
    } as ReturnType<typeof useGetIdentity>);

    render(<UpdatePasswordPage />);

    expect(document.querySelector('input[name="password"]')).toBeNull();
    expect(screen.getByTestId("external-password-hint").textContent).toBe(
      "pages.updatePassword.externalManaged",
    );
  });
});
