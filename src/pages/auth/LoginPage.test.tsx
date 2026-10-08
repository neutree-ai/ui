import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Radix Checkbox measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockLogin = vi.fn();

vi.mock("@refinedev/core", () => ({
  useActiveAuthProvider: () => ({}),
  useLogin: () => ({ mutate: mockLogin, isLoading: false }),
  useLink: () => (props: { to: string; children: React.ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
  useRouterContext: () => ({}),
  useRouterType: () => "new",
  useParsed: vi.fn(() => ({ params: {} })),
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { name?: string }) =>
      opts?.name ? `${key}:${opts.name}` : key,
  }),
}));

vi.mock("./ThemedTitle", () => ({ ThemedTitle: () => null }));

vi.mock("@/foundation/hooks/use-login-identity-sources", () => ({
  useLoginIdentitySources: vi.fn(() => ({
    isLoading: false,
    ldapSources: [],
    oidcSources: [],
  })),
}));

vi.mock("@/foundation/lib/api", () => ({ REST_URL: "http://h/api/v1" }));

import { useParsed } from "@refinedev/core";
import { useLoginIdentitySources } from "@/foundation/hooks/use-login-identity-sources";
import { takePostLoginPath } from "@/foundation/lib/sso-callback";
import { LoginPage } from "./LoginPage";

const withSources = (
  ldap: { name: string; display_name: string }[],
  oidc: { name: string; display_name: string }[],
) =>
  vi.mocked(useLoginIdentitySources).mockReturnValue({
    isLoading: false,
    ldapSources: ldap.map((s) => ({ ...s, type: "ldap" as const })),
    oidcSources: oidc.map((s) => ({ ...s, type: "oidc" as const })),
  });

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("LoginPage", () => {
  it("shows only the local form when no identity source is enabled", () => {
    withSources([], []);
    render(<LoginPage />);

    expect(document.querySelector('input[name="email"]')).not.toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByText(/continueWith/)).toBeNull();
    expect(screen.queryByText("pages.login.signup")).toBeNull();
    expect(document.querySelector('a[href="/register"]')).toBeNull();
  });

  it("offers a tab per LDAP source next to the local account", () => {
    withSources(
      [
        { name: "corp-ldap", display_name: "Corp Directory" },
        { name: "lab-ldap", display_name: "Lab Directory" },
      ],
      [],
    );
    render(<LoginPage />);

    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "pages.login.tabs.local",
      "Corp Directory",
      "Lab Directory",
    ]);
  });

  it("logs in with the chosen LDAP source", () => {
    withSources(
      [
        { name: "corp-ldap", display_name: "Corp Directory" },
        { name: "lab-ldap", display_name: "Lab Directory" },
      ],
      [],
    );
    render(<LoginPage />);

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Lab Directory" }), {
      button: 0,
    });
    const form = screen.getByTestId("ldap-login-form-lab-ldap");
    fireEvent.change(form.querySelector('input[name="username"]') as Element, {
      target: { value: "alice" },
    });
    fireEvent.change(form.querySelector('input[name="password"]') as Element, {
      target: { value: "secret" },
    });
    fireEvent.submit(form);

    expect(mockLogin).toHaveBeenCalledWith({
      method: "ldap",
      source: "lab-ldap",
      username: "alice",
      password: "secret",
    });
  });

  it("starts an OIDC login at the authorize endpoint, returning to this page", () => {
    withSources([], [{ name: "keycloak", display_name: "Keycloak" }]);
    vi.mocked(useParsed).mockReturnValue({
      params: { to: "/default/endpoints" },
    } as ReturnType<typeof useParsed>);
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      origin: "http://ui.test:3000",
      pathname: "/",
      assign,
    });

    render(<LoginPage />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "pages.login.buttons.continueWith:Keycloak",
      }),
    );

    const url = new URL(assign.mock.calls[0][0]);
    expect(`${url.origin}${url.pathname}`).toBe(
      "http://h/api/v1/auth/oidc/authorize",
    );
    expect(url.searchParams.get("source")).toBe("keycloak");
    expect(url.searchParams.get("redirect_to")).toBe("http://ui.test:3000/");
    expect(takePostLoginPath()).toBe("/default/endpoints");
  });
});

describe("LoginPage while the sources load", () => {
  it("keeps what the user typed when the LDAP tabs appear", () => {
    withSources([], []);
    const { rerender } = render(<LoginPage />);
    const email = document.querySelector(
      'input[name="email"]',
    ) as HTMLInputElement;
    fireEvent.change(email, { target: { value: "admin@neutree.local" } });

    withSources([{ name: "corp-ldap", display_name: "Corp Directory" }], []);
    rerender(<LoginPage />);

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(
      (document.querySelector('input[name="email"]') as HTMLInputElement).value,
    ).toBe("admin@neutree.local");
  });
});
