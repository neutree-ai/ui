import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { FormProvider, type UseFormReturn } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  useLicense: vi.fn(),
}));

vi.mock("@/foundation/hooks/use-has-permission", () => ({
  useHasGlobalPermission: vi.fn(),
  useHasPermission: vi.fn(),
}));

vi.mock("@/foundation/components/WorkspaceField", () => ({
  default: React.forwardRef(() => <div data-testid="workspace-field-mock" />),
}));

import type { RoleAssignment } from "@/domains/role-assignment/types";
import {
  useHasGlobalPermission,
  useHasPermission,
} from "@/foundation/hooks/use-has-permission";
import { useLicense } from "@/foundation/hooks/use-license";
import { useRoleAssignmentForm } from "./use-role-assignment-form";

/** Stands in for the organization domain's picker: one click picks "rnd". */
const OrgUnitFieldMock = React.forwardRef<
  HTMLButtonElement,
  { value?: string | null; onChange?: (value: string) => void }
>(({ value, onChange }, ref) => (
  <button
    ref={ref}
    type="button"
    data-testid="org-unit-field-mock"
    onClick={() => onChange?.("rnd")}
  >
    {value}
  </button>
));

let formRef: UseFormReturn<RoleAssignment> | undefined;

function TestForm({ action = "create" }: { action?: "create" | "edit" }) {
  const { form, specFields } = useRoleAssignmentForm({
    action,
    orgUnitField: <OrgUnitFieldMock />,
  });
  formRef = form as unknown as UseFormReturn<RoleAssignment>;
  return (
    <FormProvider {...form}>
      <form>{specFields}</form>
    </FormProvider>
  );
}

const spec = () => formRef?.getValues("spec");

function scopeTrigger() {
  const trigger = screen
    .getByTestId("field-spec.global")
    .querySelector('button[role="combobox"]');
  if (!trigger) throw new Error("select trigger not found");
  return trigger as HTMLButtonElement;
}

function scopeOptions() {
  fireEvent.click(scopeTrigger());
  return screen.getAllByRole("option").map((option) => option.textContent);
}

function selectScope(label: string) {
  fireEvent.click(scopeTrigger());
  fireEvent.click(screen.getByRole("option", { name: label }));
}

const GLOBAL = "role_assignments.options.global";
const WORKSPACE = "role_assignments.options.workspace";
const SUBTREE = "role_assignments.options.orgUnit";

function setup({
  isEnterprise = true,
  supportMultiWorkspace = true,
  globalGrant = true,
}: {
  isEnterprise?: boolean;
  supportMultiWorkspace?: boolean;
  globalGrant?: boolean;
} = {}) {
  vi.mocked(useLicense).mockReturnValue({
    supportMultiWorkspace,
    isEnterprise,
  } as ReturnType<typeof useLicense>);
  vi.mocked(useHasGlobalPermission).mockReturnValue({
    allowed: globalGrant,
    isLoading: false,
  });
  vi.mocked(useHasPermission).mockReturnValue({
    allowed: true,
    isLoading: false,
  });
}

describe("useRoleAssignmentForm", () => {
  beforeEach(() => {
    formRef = undefined;
    setup();
  });

  describe("scope", () => {
    it("builds a global spec", async () => {
      render(<TestForm />);
      selectScope(WORKSPACE);
      selectScope(GLOBAL);

      await waitFor(() =>
        expect(spec()).toMatchObject({
          global: true,
          workspace: null,
          org_unit: null,
        }),
      );
      expect(screen.getByTestId("field-spec.workspace").className).toContain(
        "hidden",
      );
      expect(screen.getByTestId("field-spec.org_unit").className).toContain(
        "hidden",
      );
    });

    it("builds a workspace spec", async () => {
      render(<TestForm />);
      selectScope(WORKSPACE);

      await waitFor(() =>
        expect(spec()).toMatchObject({ global: false, org_unit: null }),
      );
      expect(
        screen.getByTestId("field-spec.workspace").className,
      ).not.toContain("hidden");
    });

    it("builds a subtree spec from the picked department", async () => {
      render(<TestForm />);
      selectScope(SUBTREE);

      expect(screen.getByTestId("field-spec.org_unit").className).not.toContain(
        "hidden",
      );
      fireEvent.click(screen.getByTestId("org-unit-field-mock"));

      await waitFor(() =>
        expect(spec()).toMatchObject({
          global: false,
          workspace: null,
          org_unit: "rnd",
        }),
      );
    });

    it("clears the other scopes' fields when switching", async () => {
      render(<TestForm />);
      selectScope(WORKSPACE);
      act(() => formRef?.setValue("spec.workspace", "ws-1"));

      selectScope(SUBTREE);
      await waitFor(() =>
        expect(spec()).toMatchObject({
          global: false,
          workspace: null,
          org_unit: "",
        }),
      );

      fireEvent.click(screen.getByTestId("org-unit-field-mock"));
      selectScope(GLOBAL);
      await waitFor(() =>
        expect(spec()).toMatchObject({
          global: true,
          workspace: null,
          org_unit: null,
        }),
      );
    });

    it("requires a department for a subtree scope", async () => {
      render(<TestForm />);
      selectScope(SUBTREE);

      let valid: boolean | undefined;
      await act(async () => {
        valid = await formRef?.trigger("spec.org_unit");
      });
      expect(valid).toBe(false);
    });
  });

  describe("edit", () => {
    it("submits the whole spec, org_unit included", async () => {
      render(<TestForm action="edit" />);
      // refine fills only the fields present in the defaults (NEU-717).
      expect(spec()).toHaveProperty("org_unit", null);

      act(() =>
        formRef?.reset({
          api_version: "v1",
          kind: "RoleAssignment",
          metadata: { name: "ra-1" } as RoleAssignment["metadata"],
          spec: {
            user_id: "u-1",
            role: "viewer",
            global: false,
            workspace: null,
            org_unit: "rnd",
          },
        }),
      );

      let submitted: RoleAssignment | undefined;
      await act(async () => {
        await formRef?.handleSubmit((data) => {
          submitted = data;
        })();
      });
      expect(submitted?.spec).toEqual({
        user_id: "u-1",
        role: "viewer",
        global: false,
        workspace: null,
        org_unit: "rnd",
      });
      expect(scopeTrigger().textContent).toBe(SUBTREE);
    });
  });

  describe("available scopes", () => {
    it("offers all three scopes in the enterprise edition", () => {
      render(<TestForm />);
      expect(scopeOptions()).toEqual([GLOBAL, WORKSPACE, SUBTREE]);
    });

    it("hides the subtree scope in the community edition", () => {
      setup({ isEnterprise: false });
      render(<TestForm />);
      expect(scopeOptions()).toEqual([GLOBAL, WORKSPACE]);
    });

    it("gives a delegated administrator only the subtree scope, preselected", async () => {
      setup({ globalGrant: false });
      render(<TestForm />);

      await waitFor(() => expect(scopeTrigger().textContent).toBe(SUBTREE));
      expect(spec()).toMatchObject({
        global: false,
        workspace: null,
        org_unit: "",
      });
      expect(scopeTrigger().disabled).toBe(true);
    });

    it("stays global-only without multi-workspace in community", () => {
      setup({ isEnterprise: false, supportMultiWorkspace: false });
      render(<TestForm />);

      expect(spec()?.global).toBe(true);
      expect(scopeTrigger().disabled).toBe(true);
    });
  });
});
