import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { FormProvider } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@refinedev/react-hook-form", async () => {
  const rhf =
    await vi.importActual<typeof import("react-hook-form")>("react-hook-form");
  return {
    useForm: (opts: Record<string, unknown>) => {
      const { refineCoreProps, warnWhenUnsavedChanges, ...rhfOpts } = opts;
      return {
        ...rhf.useForm(rhfOpts),
        refineCore: { onFinish: vi.fn() },
      };
    },
  };
});

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspace: () => ({ current: "default" }),
}));

vi.mock("@/foundation/components/WorkspaceField", () => ({
  default: React.forwardRef(() => <div data-testid="workspace-field-mock" />),
}));

import { useExternalEndpointForm } from "./use-external-endpoint-form";

function CreateForm() {
  const { form, metadataFields, specFields } = useExternalEndpointForm({
    action: "create",
  });
  return (
    <FormProvider {...form}>
      <form>
        {metadataFields}
        {specFields}
      </form>
    </FormProvider>
  );
}

function EditForm() {
  const { form, metadataFields, specFields } = useExternalEndpointForm({
    action: "edit",
  });
  return (
    <FormProvider {...form}>
      <form>
        {metadataFields}
        {specFields}
      </form>
    </FormProvider>
  );
}

describe("useExternalEndpointForm", () => {
  describe("create mode", () => {
    it("renders name, upstream URL, auth type, and credential fields", () => {
      render(<CreateForm />);
      expect(screen.getByLabelText("common.fields.name")).toBeTruthy();
      expect(
        screen.getByLabelText("external_endpoints.fields.upstreamUrl"),
      ).toBeTruthy();
      expect(
        screen.getByLabelText("external_endpoints.fields.authType"),
      ).toBeTruthy();
      expect(
        screen.getByLabelText("external_endpoints.fields.credential"),
      ).toBeTruthy();
    });

    it("shows validation error when name is empty", async () => {
      render(<CreateForm />);
      const nameInput = screen.getByLabelText("common.fields.name");
      fireEvent.change(nameInput, { target: { value: "a" } });
      fireEvent.change(nameInput, { target: { value: "" } });
      fireEvent.blur(nameInput);

      await waitFor(() => {
        expect(
          screen.getByText("external_endpoints.validation.nameRequired"),
        ).toBeTruthy();
      });
    });

    it("shows validation error when upstream URL is empty", async () => {
      render(<CreateForm />);
      const urlInput = screen.getByLabelText(
        "external_endpoints.fields.upstreamUrl",
      );
      fireEvent.change(urlInput, { target: { value: "a" } });
      fireEvent.change(urlInput, { target: { value: "" } });
      fireEvent.blur(urlInput);

      await waitFor(() => {
        expect(
          screen.getByText("external_endpoints.validation.upstreamUrlRequired"),
        ).toBeTruthy();
      });
    });

    it("name field is not disabled", () => {
      render(<CreateForm />);
      const nameInput = screen.getByLabelText("common.fields.name");
      expect((nameInput as HTMLInputElement).disabled).toBe(false);
    });

    it("adds a new upstream when add button is clicked", async () => {
      render(<CreateForm />);
      expect(
        screen.getAllByLabelText("external_endpoints.fields.upstreamUrl"),
      ).toHaveLength(1);

      fireEvent.click(
        screen.getByText("external_endpoints.actions.addUpstream"),
      );

      await waitFor(() => {
        expect(
          screen.getAllByLabelText("external_endpoints.fields.upstreamUrl"),
        ).toHaveLength(2);
      });
    });

    it("removes an upstream when remove button is clicked", async () => {
      render(<CreateForm />);
      // Add a second upstream first
      fireEvent.click(
        screen.getByText("external_endpoints.actions.addUpstream"),
      );

      await waitFor(() => {
        expect(
          screen.getAllByLabelText("external_endpoints.fields.upstreamUrl"),
        ).toHaveLength(2);
      });

      // Remove the first upstream (trash buttons are now enabled)
      const removeButtons = screen.getAllByRole("button", { name: "" });
      const trashButton = removeButtons.find(
        (btn) => btn.querySelector(".lucide-trash-2") !== null,
      );
      if (trashButton) fireEvent.click(trashButton);

      await waitFor(() => {
        expect(
          screen.getAllByLabelText("external_endpoints.fields.upstreamUrl"),
        ).toHaveLength(1);
      });
    });
  });

  describe("edit mode", () => {
    it("disables name field", () => {
      render(<EditForm />);
      const nameInput = screen.getByLabelText("common.fields.name");
      expect((nameInput as HTMLInputElement).disabled).toBe(true);
    });

    it("shows credential hint description", () => {
      render(<EditForm />);
      expect(
        screen.getByText("common.messages.leaveEmptyToKeepValue"),
      ).toBeTruthy();
    });
  });
});
