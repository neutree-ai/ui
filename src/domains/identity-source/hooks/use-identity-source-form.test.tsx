import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { toFormValues } from "@/domains/identity-source/lib/identity-source-values";
import type { IdentitySource } from "@/domains/identity-source/types";
import { fillField, selectOption } from "@/foundation/testing/interactions";
import { refineForm } from "@/foundation/testing/refine-form";
import { renderForm } from "@/foundation/testing/render-form";
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

function renderIdentitySourceForm(action: "create" | "edit") {
  const rendered = renderForm(
    () => useIdentitySourceForm({ action }),
    (r) => (
      <>
        {r.metadataFields}
        {r.specFields}
      </>
    ),
  );
  if (action === "edit") {
    act(() =>
      rendered.result.current.form.reset(
        toFormValues(ldapRecord, "http://h/api/v1", "http://h/"),
      ),
    );
  }
  const submit = () =>
    act(() =>
      rendered.result.current.form.handleSubmit((values) =>
        rendered.result.current.form.refineCore.onFinish(values),
      )(),
    );
  return { ...rendered, submit };
}

const input = (name: string) =>
  within(screen.getByTestId(`field-${name}`)).getByRole(
    "textbox",
  ) as HTMLInputElement;

const submittedSpec = () => refineForm.onFinish.mock.calls[0][0].spec;

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("useIdentitySourceForm", () => {
  it("swaps LDAP for OIDC fields, defaulting OIDC to this deployment's root", async () => {
    window.history.pushState(null, "", "/identity-sources/create");
    renderIdentitySourceForm("create");
    screen.getByTestId("field-spec.ldap.url");

    selectOption("spec.type", "identity_sources.types.oidc");

    await screen.findByTestId("field-spec.oidc.issuer");
    expect(screen.queryByTestId("field-spec.ldap.url")).toBeNull();
    expect(input("spec.oidc.redirect_url").value).toMatch(
      /\/api\/v1\/auth\/oidc\/callback$/,
    );
    // The UI root, not the form's own path.
    expect(input("spec.oidc.allowed_redirects").value).toBe(
      `${window.location.origin}/`,
    );
  });

  it("shows each LDAP rule's message and requires the bind password on create", async () => {
    const { submit } = renderIdentitySourceForm("create");
    fillField("metadata.name", "Bad.Name");
    fillField("spec.ldap.url", "http://ldap.example.org");
    fillField("spec.ldap.user_filter", "(uid=*)");

    await submit();

    screen.getByText("identity_sources.validation.name");
    screen.getByText("identity_sources.validation.ldapUrl");
    screen.getByText("identity_sources.validation.userFilter");
    within(screen.getByTestId("field-spec.ldap.bind_password")).getByText(
      "identity_sources.validation.required",
    );
    expect(refineForm.onFinish).not.toHaveBeenCalled();
  });

  it("shows each OIDC rule's message", async () => {
    const { submit } = renderIdentitySourceForm("create");
    selectOption("spec.type", "identity_sources.types.oidc");
    await screen.findByTestId("field-spec.oidc.scopes");
    fillField("spec.oidc.issuer", "ftp://idp.example.org");
    fillField("spec.oidc.scopes", "profile email");
    fillField("spec.oidc.allowed_redirects", "https://x.example.org/#/home");

    await submit();

    screen.getByText("identity_sources.validation.scopes");
    screen.getByText("identity_sources.validation.httpUrl");
    screen.getByText("identity_sources.validation.allowedRedirect");
    expect(refineForm.onFinish).not.toHaveBeenCalled();
  });

  it("submits the create payload: the chosen type only, with the password", async () => {
    const { submit } = renderIdentitySourceForm("create");
    fillField("metadata.name", "corp-ldap-2");
    fillField("spec.ldap.url", "ldaps://ldap.example.org:636");
    fillField("spec.ldap.bind_dn", "cn=svc,dc=example,dc=org");
    fillField("spec.ldap.bind_password", "pw");
    fillField("spec.ldap.user_base_dn", "ou=people,dc=example,dc=org");

    await submit();

    await waitFor(() => expect(refineForm.onFinish).toHaveBeenCalledTimes(1));
    expect(submittedSpec().oidc).toBeNull();
    expect(submittedSpec().ldap.bind_password).toBe("pw");
  });

  describe("edit", () => {
    it("keeps the name and type fixed and explains blank secrets", () => {
      renderIdentitySourceForm("edit");
      expect(input("metadata.name").value).toBe("corp-ldap");
      expect(input("metadata.name").disabled).toBe(true);
      expect(
        (
          within(screen.getByTestId("field-spec.type")).getByRole(
            "combobox",
          ) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      within(screen.getByTestId("field-spec.ldap.bind_password")).getByText(
        "identity_sources.hints.keepSecret",
      );
    });

    it("submits the edit payload: the whole metadata, no blank password", async () => {
      const { submit } = renderIdentitySourceForm("edit");

      await submit();

      await waitFor(() => expect(refineForm.onFinish).toHaveBeenCalledTimes(1));
      const payload = refineForm.onFinish.mock.calls[0][0];
      expect(payload).not.toHaveProperty("api_version");
      expect(payload.metadata).toMatchObject({ name: "corp-ldap", labels: {} });
      expect(payload.spec.ldap).not.toHaveProperty("bind_password");
    });
  });
});
