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
      return rhf.useForm(rhfOpts);
    },
  };
});

vi.mock("@refinedev/core", () => ({
  useSelect: () => ({
    query: { data: { data: [] }, isLoading: false },
  }),
}));

vi.mock("@/foundation/hooks/use-license", () => ({
  useLicense: vi.fn(() => ({ supportMultiWorkspace: true })),
}));

vi.mock("@/foundation/components/WorkspaceField", () => ({
  default: React.forwardRef(() => <div data-testid="workspace-field-mock" />),
}));

import { useLicense } from "@/foundation/hooks/use-license";
import { useRoleAssignmentForm } from "./use-role-assignment-form";

function CreateForm() {
  const { form, specFields } = useRoleAssignmentForm({ action: "create" });
  return (
    <FormProvider {...form}>
      <form>{specFields}</form>
    </FormProvider>
  );
}

function selectScope(label: string) {
  const field = screen.getByTestId("field-spec.global");
  const trigger = field.querySelector('button[role="combobox"]');
  if (!trigger) throw new Error("select trigger not found");
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("option", { name: label }));
}

describe("useRoleAssignmentForm", () => {
  describe("global/workspace toggle", () => {
    it("hides workspace field when global is selected", async () => {
      render(<CreateForm />);

      selectScope("role_assignments.options.global");

      await waitFor(() => {
        expect(screen.getByTestId("field-spec.workspace").className).toContain(
          "hidden",
        );
      });
    });

    it("shows workspace field when workspace scope is selected", async () => {
      render(<CreateForm />);

      selectScope("role_assignments.options.global");
      selectScope("role_assignments.options.workspace");

      await waitFor(() => {
        expect(
          screen.getByTestId("field-spec.workspace").className,
        ).not.toContain("hidden");
      });
    });

    it("clears workspace value when switching to global", async () => {
      render(<CreateForm />);

      selectScope("role_assignments.options.workspace");
      selectScope("role_assignments.options.global");

      await waitFor(() => {
        expect(screen.getByTestId("field-spec.workspace").className).toContain(
          "hidden",
        );
      });
    });

    it("defaults to global when multi-workspace is not supported", () => {
      vi.mocked(useLicense).mockReturnValue({
        supportMultiWorkspace: false,
      } as ReturnType<typeof useLicense>);
      render(<CreateForm />);

      expect(screen.getByTestId("field-spec.workspace").className).toContain(
        "hidden",
      );
    });
  });
});
