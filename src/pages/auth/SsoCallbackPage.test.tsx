import { render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGo = vi.fn();
const mockInvalidateAuthStore = vi.fn(async () => {});

vi.mock("@refinedev/core", () => ({
  useGo: () => mockGo,
  useInvalidateAuthStore: () => mockInvalidateAuthStore,
  useLink: () => (props: { to: string; children: React.ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("./ThemedTitle", () => ({ ThemedTitle: () => null }));

vi.mock("@/foundation/providers/auth-provider", () => ({
  verifySsoToken: vi.fn(),
}));

import {
  captureSsoCallback,
  clearCapturedSsoCallback,
  getCapturedSsoCallback,
  rememberPostLoginPath,
} from "@/foundation/lib/sso-callback";
import { verifySsoToken } from "@/foundation/providers/auth-provider";
import { SsoCallbackPage } from "./SsoCallbackPage";

const arrive = (hash: string) =>
  captureSsoCallback(
    { hash, pathname: "/", search: "" },
    { replaceState: () => {} },
  );

beforeEach(() => {
  vi.clearAllMocks();
  clearCapturedSsoCallback();
  sessionStorage.clear();
});

describe("SsoCallbackPage", () => {
  it("redeems the token once and goes to the remembered page", async () => {
    vi.mocked(verifySsoToken).mockResolvedValue({ success: true });
    rememberPostLoginPath("/default/endpoints");
    arrive("#token_hash=tok-success&type=magiclink");

    render(<SsoCallbackPage />);

    expect(screen.getByText("pages.ssoCallback.signingIn")).toBeTruthy();
    await waitFor(() =>
      expect(mockGo).toHaveBeenCalledWith({
        to: "/default/endpoints",
        type: "replace",
      }),
    );
    expect(verifySsoToken).toHaveBeenCalledTimes(1);
    expect(verifySsoToken).toHaveBeenCalledWith("tok-success");
    expect(mockInvalidateAuthStore).toHaveBeenCalled();
    expect(getCapturedSsoCallback()).toBeNull();
  });

  it("goes home when no page was remembered", async () => {
    vi.mocked(verifySsoToken).mockResolvedValue({ success: true });
    arrive("#token_hash=tok-home&type=magiclink");

    render(<SsoCallbackPage />);

    await waitFor(() =>
      expect(mockGo).toHaveBeenCalledWith({ to: "/", type: "replace" }),
    );
  });

  it("shows an error when the token is rejected", async () => {
    vi.mocked(verifySsoToken).mockResolvedValue({ success: false });
    arrive("#token_hash=tok-used&type=magiclink");

    render(<SsoCallbackPage />);

    expect(
      await screen.findByText("pages.ssoCallback.errors.verifyFailed"),
    ).toBeTruthy();
    expect(mockGo).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "pages.ssoCallback.backToLogin" }),
    ).toHaveProperty("href", expect.stringContaining("/login"));
  });

  it("shows the server's error code without verifying anything", () => {
    arrive("#error=login_failed");

    render(<SsoCallbackPage />);

    expect(screen.getByTestId("sso-callback-error").textContent).toBe(
      "pages.ssoCallback.errors.login_failed",
    );
    expect(verifySsoToken).not.toHaveBeenCalled();
  });

  it("uses a generic message for an unknown error code", () => {
    arrive("#error=something_new");

    render(<SsoCallbackPage />);

    expect(screen.getByTestId("sso-callback-error").textContent).toBe(
      "pages.ssoCallback.errors.unknown",
    );
  });

  it("explains a callback opened without a result", () => {
    render(<SsoCallbackPage />);

    expect(screen.getByTestId("sso-callback-error").textContent).toBe(
      "pages.ssoCallback.errors.missing",
    );
    expect(verifySsoToken).not.toHaveBeenCalled();
  });
});
