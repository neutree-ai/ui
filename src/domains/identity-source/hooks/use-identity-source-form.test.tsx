import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { FormProvider } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const onFinish = vi.fn();

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@refinedev/react-hook-form", async () => {
  const rhf =
    await vi.importActual<typeof import("react-hook-form")>("react-hook-form");
  return {
    useForm: (opts: Record<string, unknown>) => {
      const { refineCoreProps, warnWhenUnsavedChanges, ...rhfOpts } = opts;
      return { ...rhf.useForm(rhfOpts), refineCore: { onFinish } };
    },
  };
});

import { toFormValues } from "@/domains/identity-source/lib/identity-source-values";
import type { IdentitySource } from "@/domains/identity-source/types";
import { useIdentitySourceForm } from "./use-identity-source-form";

const ldapRecord = {
  id: 1,
  api_version: "v1",
  kind: "IdentitySource",
  metadata: { name: "corp-ldap", display_name: "Corp", labels: {} },
  spec: {
    type: "ldap",
    enabled: true,
    ldap: {
      url: "ldaps://ldap.example.org:636",
      bind_dn: "cn=svc,dc=example,dc=org",
      bind_password: null,
      user_base_dn: "ou=people,dc=example,dc=org",
      user_filter: "(uid={username})",
      timeout: 10,
    },
    oidc: null,
  },
} as unknown as IdentitySource;

function TestForm({
  action,
  record,
}: {
  action: "create" | "edit";
  record?: IdentitySource;
}) {
  const { form, metadataFields, specFields, adminNote } = useIdentitySourceForm(
    { action },
  );
  const { reset } = form;
  useEffect(() => {
    if (record) {
      reset(toFormValues(record, "http://h/api/v1", "http://h/"));
    }
  }, [reset, record]);
  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit((values) =>
          form.refineCore.onFinish(values),
        )}
      >
        {metadataFields}
        {specFields}
        {adminNote}
        <button type="submit">submit</button>
      </form>
    </FormProvider>
  );
}

const input = (name: string) => {
  const el = screen
    .getByTestId(`field-${name}`)
    .querySelector("input, textarea") as HTMLInputElement | null;
  if (!el) throw new Error(`no input for ${name}`);
  return el;
};

const type = (name: string, value: string) =>
  fireEvent.change(input(name), { target: { value } });

function selectOption(fieldTestId: string, optionLabel: string) {
  const trigger = screen
    .getByTestId(fieldTestId)
    .querySelector('button[role="combobox"]');
  if (!trigger) throw new Error("select trigger not found");
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("option", { name: optionLabel }));
}

beforeEach(() => {
  onFinish.mockReset();
});

describe("useIdentitySourceForm", () => {
  it("shows LDAP fields by default and OIDC fields after switching type", async () => {
    render(<TestForm action="create" />);
    expect(screen.getByTestId("field-spec.ldap.url")).toBeTruthy();
    expect(screen.queryByTestId("field-spec.oidc.issuer")).toBeNull();

    selectOption("field-spec.type", "identity_sources.types.oidc");

    await waitFor(() =>
      expect(screen.getByTestId("field-spec.oidc.issuer")).toBeTruthy(),
    );
    expect(screen.queryByTestId("field-spec.ldap.url")).toBeNull();
    // defaults point at this deployment
    expect(input("spec.oidc.redirect_url").value).toMatch(
      /\/api\/v1\/auth\/oidc\/callback$/,
    );
    expect(input("spec.oidc.allowed_redirects").value).toBe(
      `${window.location.origin}${window.location.pathname}`,
    );
  });

  it("states that managing identity sources is admin-equivalent", () => {
    render(<TestForm action="create" />);
    expect(screen.getByTestId("identity-source-admin-note").textContent).toBe(
      "identity_sources.hints.adminEquivalent",
    );
  });

  it("requires the bind password on create and validates LDAP fields", async () => {
    render(<TestForm action="create" />);
    type("metadata.name", "Bad.Name");
    type("spec.ldap.url", "http://ldap.example.org");
    type("spec.ldap.user_filter", "(uid=*)");
    fireEvent.click(screen.getByText("submit"));

    await waitFor(() =>
      expect(screen.getByText("identity_sources.validation.name")).toBeTruthy(),
    );
    expect(
      screen.getByText("identity_sources.validation.ldapUrl"),
    ).toBeTruthy();
    expect(
      screen.getByText("identity_sources.validation.userFilter"),
    ).toBeTruthy();
    expect(
      screen
        .getByTestId("field-spec.ldap.bind_password")
        .textContent?.includes("identity_sources.validation.required"),
    ).toBe(true);
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("rejects OIDC scopes without openid and bad redirect URLs", async () => {
    render(<TestForm action="create" />);
    selectOption("field-spec.type", "identity_sources.types.oidc");
    await waitFor(() => screen.getByTestId("field-spec.oidc.scopes"));
    type("spec.oidc.issuer", "ftp://idp.example.org");
    type("spec.oidc.scopes", "profile email");
    type("spec.oidc.allowed_redirects", "https://x.example.org/#/home");
    fireEvent.click(screen.getByText("submit"));

    await waitFor(() =>
      expect(
        screen.getByText("identity_sources.validation.scopes"),
      ).toBeTruthy(),
    );
    expect(
      screen.getByText("identity_sources.validation.httpUrl"),
    ).toBeTruthy();
    expect(
      screen.getByText("identity_sources.validation.allowedRedirect"),
    ).toBeTruthy();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("creates an LDAP source with only LDAP settings and the password", async () => {
    render(<TestForm action="create" />);
    type("metadata.name", "corp-ldap-2");
    type("spec.ldap.url", "ldaps://ldap.example.org:636");
    type("spec.ldap.bind_dn", "cn=svc,dc=example,dc=org");
    type("spec.ldap.bind_password", "pw");
    type("spec.ldap.user_base_dn", "ou=people,dc=example,dc=org");
    fireEvent.click(screen.getByText("submit"));

    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    const payload = onFinish.mock.calls[0][0];
    expect(payload.metadata).toEqual({ name: "corp-ldap-2", display_name: "" });
    expect(payload.spec.oidc).toBeNull();
    expect(payload.spec.ldap.bind_password).toBe("pw");
  });

  describe("edit", () => {
    it("keeps the name and type fixed and explains blank secrets", async () => {
      render(<TestForm action="edit" record={ldapRecord} />);
      await waitFor(() =>
        expect(input("metadata.name").value).toBe("corp-ldap"),
      );
      expect(input("metadata.name").disabled).toBe(true);
      expect(
        screen
          .getByTestId("field-spec.type")
          .querySelector("button[role=combobox]")
          ?.hasAttribute("disabled"),
      ).toBe(true);
      expect(
        screen.getByTestId("field-spec.ldap.bind_password").textContent,
      ).toContain("identity_sources.hints.keepSecret");
    });

    it("does not send a password left blank", async () => {
      render(<TestForm action="edit" record={ldapRecord} />);
      await waitFor(() =>
        expect(input("metadata.name").value).toBe("corp-ldap"),
      );
      type("metadata.display_name", "Corp 2");
      fireEvent.click(screen.getByText("submit"));

      await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
      const payload = onFinish.mock.calls[0][0];
      expect(payload.metadata).toMatchObject({
        name: "corp-ldap",
        display_name: "Corp 2",
        labels: {},
      });
      expect(payload.spec.ldap).not.toHaveProperty("bind_password");
    });

    it("sends a password that was typed in", async () => {
      render(<TestForm action="edit" record={ldapRecord} />);
      await waitFor(() =>
        expect(input("metadata.name").value).toBe("corp-ldap"),
      );
      type("spec.ldap.bind_password", "rotated");
      fireEvent.click(screen.getByText("submit"));

      await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
      expect(onFinish.mock.calls[0][0].spec.ldap.bind_password).toBe("rotated");
    });
  });
});
