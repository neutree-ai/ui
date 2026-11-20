import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { refineForm } from "@/foundation/testing/refine-form";
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

  it("submits create values and forwards the returned id, department and teams", async () => {
    const onCreated = vi.fn();
    const { result } = renderForm(
      () => useUserForm({ action: "create", onCreated }),
      (r) => r.registerFields,
    );
    const values = {
      name: "alice",
      email: "alice@example.org",
      password: "password123",
      confirmPassword: "password123",
      orgUnit: "eng",
      teams: ["guild", "launch"],
    };
    act(() => result.current.form.reset(values));
    await act(() => result.current.form.handleSubmit(refineForm.onFinish)());
    expect(refineForm.onFinish).toHaveBeenCalledWith(values, undefined);

    const options = refineForm.options?.refineCoreProps as {
      onMutationSuccess: (data: unknown, variables: unknown) => unknown;
    };
    options.onMutationSuccess({ data: { id: "u-1" } }, values);
    expect(onCreated).toHaveBeenCalledWith({
      id: "u-1",
      orgUnit: "eng",
      teams: ["guild", "launch"],
    });
    options.onMutationSuccess({ data: { id: "u-2" } }, {});
    expect(onCreated).toHaveBeenLastCalledWith({
      id: "u-2",
      orgUnit: "",
      teams: [],
    });
  });

  it.each([
    { source: "", email: "alice@example.org", changed: undefined },
    { source: "ldap", email: "alice@example.org", changed: undefined },
    { source: "oidc", email: "id@corp.oidc.neutree.local", changed: undefined },
    { source: "ldap", email: "", changed: undefined },
    { source: "", email: null, changed: undefined },
    { source: "", email: "alice@example.org", changed: "new@example.org" },
    { source: "", email: "alice@example.org", changed: "" },
  ])(
    "preserves reopen payload for $source / $email, changed to $changed",
    async ({ source, email, changed }) => {
      const record = {
        id: "u-1",
        api_version: "v1" as const,
        kind: "UserProfile" as const,
        metadata: {
          name: "alice",
          display_name: "Alice",
          labels: source ? { "neutree.ai/identity-source": source } : {},
          annotations: { team: "a" },
        },
        spec: { email },
        status: { phase: "Created", synced_spec: { email } },
      };
      const { result } = renderEdit({}, "");
      act(() => result.current.form.reset(record as never));
      if (changed !== undefined) {
        fireEvent.change(emailInput(), { target: { value: changed } });
      }
      await act(() => result.current.form.handleSubmit(refineForm.onFinish)());
      expect(refineForm.onFinish.mock.calls[0][0]).toEqual({
        ...record,
        spec: { email: changed === undefined ? email : changed },
      });
    },
  );

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

  it("shows the department field only when one is passed", () => {
    renderForm(
      () =>
        useUserForm({
          action: "create",
          departmentField: <i data-testid="dept" />,
        }),
      (r) => r.registerFields,
    );
    screen.getByTestId("dept");
  });
});
