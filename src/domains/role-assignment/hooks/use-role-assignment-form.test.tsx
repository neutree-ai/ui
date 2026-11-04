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

const TeamFieldMock = React.forwardRef<
  HTMLButtonElement,
  { value?: string | null; onChange?: (value: string) => void }
>(({ value, onChange }, ref) => (
  <button
    ref={ref}
    type="button"
    data-testid="team-field-mock"
    onClick={() => onChange?.("sre")}
  >
    {value}
  </button>
));

let formRef: UseFormReturn<RoleAssignment> | undefined;

function TestForm({ action = "create" }: { action?: "create" | "edit" }) {
  const { form, specFields } = useRoleAssignmentForm({
    action,
    orgUnitField: <OrgUnitFieldMock />,
    teamField: <TeamFieldMock />,
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

function kindTrigger() {
  const trigger = screen
    .getByTestId("field-spec.subject_kind")
    .querySelector('button[role="combobox"]');
  if (!trigger) throw new Error("select trigger not found");
  return trigger as HTMLButtonElement;
}

function kindOptions() {
  fireEvent.click(kindTrigger());
  return screen.getAllByRole("option").map((option) => option.textContent);
}

function selectKind(label: string) {
  fireEvent.click(kindTrigger());
  fireEvent.click(screen.getByRole("option", { name: label }));
}

const USER = "role_assignments.subjectKinds.User";
const TEAM = "role_assignments.subjectKinds.Team";
const DEPARTMENT = "role_assignments.subjectKinds.OrgUnit";

const GLOBAL = "role_assignments.options.global";
const WORKSPACE = "role_assignments.options.workspace";
const SUBTREE = "role_assignments.options.orgUnit";
const TEAM_SCOPE = "role_assignments.options.team";

function setup({
  supportMultiWorkspace = true,
  globalGrant = true,
}: {
  supportMultiWorkspace?: boolean;
  globalGrant?: boolean;
} = {}) {
  vi.mocked(useLicense).mockReturnValue({
    supportMultiWorkspace,
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

    it("starts global whether or not the license has loaded", () => {
      setup({ supportMultiWorkspace: false });
      const { unmount } = render(<TestForm />);
      expect(spec()?.global).toBe(true);
      unmount();

      setup({ supportMultiWorkspace: true });
      render(<TestForm />);
      expect(spec()?.global).toBe(true);
      expect(scopeTrigger().textContent).toBe(GLOBAL);
    });

    it("requires a workspace for a workspace scope", async () => {
      render(<TestForm />);
      selectScope(WORKSPACE);

      let valid: boolean | undefined;
      await act(async () => {
        valid = await formRef?.trigger("spec.workspace");
      });
      expect(valid).toBe(false);

      act(() => formRef?.setValue("spec.workspace", "ws-1"));
      await act(async () => {
        valid = await formRef?.trigger("spec.workspace");
      });
      expect(valid).toBe(true);
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

  describe("subject", () => {
    it("offers users, teams and departments to a global administrator", () => {
      render(<TestForm />);
      expect(kindOptions()).toEqual([USER, TEAM, DEPARTMENT]);
    });

    it("offers no Team to a delegated administrator", () => {
      setup({ globalGrant: false });
      render(<TestForm />);
      expect(kindOptions()).toEqual([USER, DEPARTMENT]);
    });

    it("builds a Team subject without user_id", async () => {
      render(<TestForm />);
      act(() => formRef?.setValue("spec.user_id", "u-1"));
      selectKind(TEAM);

      expect(screen.getByTestId("field-spec.user_id").className).toContain(
        "hidden",
      );
      fireEvent.click(screen.getByTestId("team-field-mock"));
      await waitFor(() =>
        expect(spec()).toMatchObject({
          subject_kind: "Team",
          subject_name: "sre",
          user_id: null,
        }),
      );
    });

    it("builds a department subject with the department picker", async () => {
      render(<TestForm />);
      selectKind(DEPARTMENT);

      let valid: boolean | undefined;
      await act(async () => {
        valid = await formRef?.trigger("spec.subject_name");
      });
      expect(valid).toBe(false);

      const field = screen.getByTestId("field-spec.subject_name");
      fireEvent.click(
        field.querySelector('[data-testid="org-unit-field-mock"]') as Element,
      );
      await waitFor(() =>
        expect(spec()).toMatchObject({
          subject_kind: "OrgUnit",
          subject_name: "rnd",
          user_id: null,
        }),
      );
    });

    it("clears the group when switching back to a user", async () => {
      render(<TestForm />);
      selectKind(TEAM);
      fireEvent.click(screen.getByTestId("team-field-mock"));
      selectKind(USER);

      await waitFor(() =>
        expect(spec()).toMatchObject({
          subject_kind: "User",
          subject_name: null,
          user_id: "",
        }),
      );
      expect(screen.queryByTestId("field-spec.subject_name")).toBeNull();
    });
  });

  describe("edit", () => {
    it("submits the whole spec of a group assignment", async () => {
      render(<TestForm action="edit" />);
      expect(spec()).toHaveProperty("subject_kind", "User");
      expect(spec()).toHaveProperty("subject_name", null);

      act(() =>
        formRef?.reset({
          api_version: "v1",
          kind: "RoleAssignment",
          metadata: { name: "ra-2" } as RoleAssignment["metadata"],
          spec: {
            user_id: null,
            role: "viewer",
            global: true,
            workspace: null,
            org_unit: null,
            subject_kind: "Team",
            subject_name: "sre",
          },
        }),
      );

      expect(kindTrigger().textContent).toBe(TEAM);
      let submitted: RoleAssignment | undefined;
      await act(async () => {
        await formRef?.handleSubmit((data) => {
          submitted = data;
        })();
      });
      expect(submitted?.spec).toEqual({
        user_id: null,
        role: "viewer",
        global: true,
        workspace: null,
        org_unit: null,
        subject_kind: "Team",
        subject_name: "sre",
      });
    });

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
            subject_kind: "User",
            subject_name: null,
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
        subject_kind: "User",
        subject_name: null,
      });
      expect(scopeTrigger().textContent).toBe(SUBTREE);
    });
  });

  describe("available scopes", () => {
    it("offers every scope, the Team one included, to a global administrator", () => {
      render(<TestForm />);
      expect(scopeOptions()).toEqual([GLOBAL, WORKSPACE, SUBTREE, TEAM_SCOPE]);
    });

    it("offers the subtree scope without multi-workspace", () => {
      setup({ supportMultiWorkspace: false });
      render(<TestForm />);

      expect(spec()?.global).toBe(true);
      expect(scopeOptions()).toEqual([GLOBAL, SUBTREE, TEAM_SCOPE]);
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
  });
});
