import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormProvider } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

vi.mock("@refinedev/core", () => ({
  useTranslation: () => ({ translate: (key: string) => key }),
}));

vi.mock("@refinedev/react-hook-form", async () => {
  const rhf =
    await vi.importActual<typeof import("react-hook-form")>("react-hook-form");
  return {
    useForm: (opts: Record<string, unknown>) => {
      const { refineCoreProps, warnWhenUnsavedChanges, ...rhfOpts } = opts;
      return rhf.useForm(rhfOpts);
    },
  };
});

import { useUserForm } from "./use-user-form";

function CreateForm() {
  const { form, registerFields } = useUserForm({ action: "create" });
  return (
    <FormProvider {...form}>
      <form>{registerFields}</form>
    </FormProvider>
  );
}

function EditForm() {
  const { form, registerFields, metadataFields, specFields } = useUserForm({
    action: "edit",
  });
  return (
    <FormProvider {...form}>
      <form>
        {registerFields}
        {metadataFields}
        {specFields}
      </form>
    </FormProvider>
  );
}

describe("useUserForm (render)", () => {
  describe("create mode", () => {
    it("renders password and confirm password fields", () => {
      render(<CreateForm />);
      expect(screen.getByLabelText("common.fields.password")).toBeTruthy();
      expect(
        screen.getByLabelText("user_profiles.fields.confirmPassword"),
      ).toBeTruthy();
    });

    it("rejects password shorter than 6 characters", async () => {
      render(<CreateForm />);
      const input = screen.getByLabelText("common.fields.password");

      fireEvent.change(input, { target: { value: "abc" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(
          screen.getByText("user_profiles.validation.passwordMinLength"),
        ).toBeTruthy();
      });
    });

    it("accepts password with 6+ characters", async () => {
      render(<CreateForm />);
      const input = screen.getByLabelText("common.fields.password");

      fireEvent.change(input, { target: { value: "abcdef" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(
          screen.queryByText("user_profiles.validation.passwordMinLength"),
        ).toBeNull();
      });
    });

    it("rejects empty confirm password", async () => {
      render(<CreateForm />);
      const cpInput = screen.getByLabelText(
        "user_profiles.fields.confirmPassword",
      );

      fireEvent.change(cpInput, { target: { value: "a" } });
      fireEvent.change(cpInput, { target: { value: "" } });
      fireEvent.blur(cpInput);

      await waitFor(() => {
        expect(
          screen.getByText("pages.auth.errors.confirmPasswordRequired"),
        ).toBeTruthy();
      });
    });

    it("rejects mismatched confirm password", async () => {
      render(<CreateForm />);
      const pwInput = screen.getByLabelText("common.fields.password");
      const cpInput = screen.getByLabelText(
        "user_profiles.fields.confirmPassword",
      );

      fireEvent.change(pwInput, { target: { value: "password123" } });
      fireEvent.change(cpInput, { target: { value: "different" } });
      fireEvent.blur(cpInput);

      await waitFor(() => {
        expect(
          screen.getByText("pages.auth.errors.confirmPasswordNotMatch"),
        ).toBeTruthy();
      });
    });

    it("accepts matching passwords", async () => {
      render(<CreateForm />);
      const pwInput = screen.getByLabelText("common.fields.password");
      const cpInput = screen.getByLabelText(
        "user_profiles.fields.confirmPassword",
      );

      fireEvent.change(pwInput, { target: { value: "password123" } });
      fireEvent.change(cpInput, { target: { value: "password123" } });
      fireEvent.blur(cpInput);

      await waitFor(() => {
        expect(
          screen.queryByText("pages.auth.errors.confirmPasswordNotMatch"),
        ).toBeNull();
      });
    });
  });

  describe("edit mode", () => {
    it("does not render password fields", () => {
      render(<EditForm />);
      expect(screen.queryByLabelText("common.fields.password")).toBeNull();
    });

    it("renders metadata name field as disabled", () => {
      render(<EditForm />);
      const input = screen.getByLabelText("common.fields.name");
      expect((input as HTMLInputElement).disabled).toBe(true);
    });
  });
});
