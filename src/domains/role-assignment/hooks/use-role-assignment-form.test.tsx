import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

let mockSupportMultiWorkspace = true;
vi.mock("@/foundation/hooks/use-license", () => ({
  useLicense: () => ({ supportMultiWorkspace: mockSupportMultiWorkspace }),
}));

vi.mock("@/foundation/components/WorkspaceField", () => ({
  default: () => <div data-testid="workspace-field-mock" />,
}));

vi.mock("@/foundation/components/FormCombobox", () => ({
  FormCombobox: () => <div data-testid="combobox-mock" />,
}));

/**
 * Mock FormSelect as a native <select> so we can drive onChange via fireEvent.
 * The real FormSelect wraps Radix Select which is hard to interact with in jsdom.
 */
vi.mock("@/foundation/components/FormSelect", () => ({
  FormSelect: ({
    options,
    onChange,
    value,
    disabled,
  }: {
    options: { label: string; value: unknown }[];
    onChange: (v: string) => void;
    value?: string;
    disabled?: boolean;
  }) => (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

import { useRoleAssignmentForm } from "./use-role-assignment-form";

function CreateForm() {
  const { form, specFields } = useRoleAssignmentForm({ action: "create" });
  return (
    <FormProvider {...form}>
      <form>{specFields}</form>
    </FormProvider>
  );
}

describe("useRoleAssignmentForm", () => {
  describe("global/workspace toggle", () => {
    function getScopeSelect() {
      // Our mock FormSelect renders a native <select> — the only one in the form.
      const el = document.querySelector("select");
      if (!el) throw new Error("scope <select> not found");
      return el;
    }

    it("hides workspace field when global is selected", async () => {
      mockSupportMultiWorkspace = true;
      render(<CreateForm />);

      fireEvent.change(getScopeSelect(), { target: { value: "true" } });

      await waitFor(() => {
        const workspaceField = screen.getByTestId("field-spec.workspace");
        expect(workspaceField.className).toContain("hidden");
      });
    });

    it("shows workspace field when workspace scope is selected", async () => {
      mockSupportMultiWorkspace = true;
      render(<CreateForm />);

      // Start global, then switch to workspace
      fireEvent.change(getScopeSelect(), { target: { value: "true" } });
      fireEvent.change(getScopeSelect(), { target: { value: "false" } });

      await waitFor(() => {
        const workspaceField = screen.getByTestId("field-spec.workspace");
        expect(workspaceField.className).not.toContain("hidden");
      });
    });

    it("clears workspace value when switching to global", async () => {
      mockSupportMultiWorkspace = true;
      render(<CreateForm />);

      // Set workspace scope first, then switch to global
      fireEvent.change(getScopeSelect(), { target: { value: "false" } });
      fireEvent.change(getScopeSelect(), { target: { value: "true" } });

      await waitFor(() => {
        const workspaceField = screen.getByTestId("field-spec.workspace");
        expect(workspaceField.className).toContain("hidden");
      });
    });

    it("defaults to global when multi-workspace is not supported", () => {
      mockSupportMultiWorkspace = false;
      render(<CreateForm />);

      const workspaceField = screen.getByTestId("field-spec.workspace");
      expect(workspaceField.className).toContain("hidden");
    });
  });
});
