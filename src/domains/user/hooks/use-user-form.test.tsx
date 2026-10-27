import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderForm } from "@/foundation/testing/render-form";
import { useUserForm } from "./use-user-form";

vi.mock("@refinedev/core", () => ({
  useTranslation: () => ({ translate: (key: string) => key }),
}));

const emailInput = () =>
  screen.getByLabelText("common.fields.email") as HTMLInputElement;

function renderEdit(labels: Record<string, string>, email: string) {
  const rendered = renderForm(
    () => useUserForm({ action: "edit" }),
    (r) => (
      <>
        {r.metadataFields}
        {r.specFields}
      </>
    ),
  );
  act(() =>
    rendered.result.current.form.reset({
      api_version: "v1",
      kind: "UserProfile",
      metadata: { name: "alice", labels },
      spec: { email },
    }),
  );
  return rendered;
}

const renderCreate = () =>
  renderForm(
    () => useUserForm({ action: "create" }),
    (r) => r.registerFields,
  );

function typePasswords(password: string, confirm: string) {
  const confirmInput = screen.getByLabelText(
    "user_profiles.fields.confirmPassword",
  );
  fireEvent.change(screen.getByLabelText("common.fields.password"), {
    target: { value: password },
  });
  // Touch the confirm field so an empty value still validates on blur.
  fireEvent.change(confirmInput, { target: { value: "x" } });
  fireEvent.change(confirmInput, { target: { value: confirm } });
  fireEvent.blur(confirmInput);
}

describe("useUserForm", () => {
  it.each([
    ["abc", "abc", "user_profiles.validation.passwordMinLength"],
    ["password123", "", "pages.auth.errors.confirmPasswordRequired"],
    ["password123", "different", "pages.auth.errors.confirmPasswordNotMatch"],
  ])(
    "rejects password %j / confirm %j with %s",
    async (password, confirm, error) => {
      renderCreate();
      typePasswords(password, confirm);
      fireEvent.blur(screen.getByLabelText("common.fields.password"));
      await screen.findByText(error);
    },
  );

  it("accepts a long enough password that matches its confirmation", async () => {
    renderCreate();
    typePasswords("password123", "password123");
    fireEvent.blur(screen.getByLabelText("common.fields.password"));
    await waitFor(() => {
      expect(screen.queryByText(/^user_profiles\.validation\./)).toBeNull();
      expect(screen.queryByText(/^pages\.auth\.errors\./)).toBeNull();
    });
  });

  it("drops the password fields and locks the name when editing", () => {
    renderForm(
      () => useUserForm({ action: "edit" }),
      (r) => (
        <>
          {r.registerFields}
          {r.metadataFields}
          {r.specFields}
        </>
      ),
    );
    expect(screen.queryByLabelText("common.fields.password")).toBeNull();
    expect(
      (screen.getByLabelText("common.fields.name") as HTMLInputElement)
        .disabled,
    ).toBe(true);
  });

  it("locks the email of a user from an identity source, with a hint", () => {
    renderEdit({ "neutree.ai/identity-source": "ldap" }, "alice@corp.example");
    expect(emailInput().value).toBe("alice@corp.example");
    expect(emailInput().disabled).toBe(true);
    screen.getByText("user_profiles.hints.externalEmail");
  });

  it("shows an external user's placeholder email as empty and submits it unchanged", async () => {
    const placeholder = "0a1b2c3d@corp-ldap.ldap.neutree.local";
    const onSubmit = vi.fn();
    const { result } = renderEdit(
      { "neutree.ai/identity-source": "ldap" },
      placeholder,
    );
    expect(emailInput().value).toBe("");
    expect(emailInput().placeholder).toBe("-");

    await act(() => result.current.form.handleSubmit(onSubmit)());

    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      spec: { email: placeholder },
    });
  });

  it("keeps a local user's email editable", () => {
    renderEdit({ team: "a" }, "alice@corp.example");
    expect(emailInput().disabled).toBe(false);
    expect(screen.queryByText("user_profiles.hints.externalEmail")).toBeNull();
  });
});
