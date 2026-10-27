import { screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { useLicense } from "@/foundation/hooks/use-license";
import { isHidden, selectOption } from "@/foundation/testing/interactions";
import { renderForm } from "@/foundation/testing/render-form";
import { useRoleAssignmentForm } from "./use-role-assignment-form";

vi.mock("@refinedev/core", () => ({
  useSelect: () => ({
    query: { data: { data: [] }, isLoading: false },
  }),
}));

vi.mock("@/foundation/hooks/use-license", () => ({
  useLicense: vi.fn(() => ({ supportMultiWorkspace: true })),
}));

vi.mock("@/foundation/components/WorkspaceField", () => ({
  default: React.forwardRef(() => <div />),
}));

const renderCreate = () =>
  renderForm(
    () => useRoleAssignmentForm({ action: "create" }),
    (r) => r.specFields,
  );
const workspaceField = () => screen.getByTestId("field-spec.workspace");

describe("useRoleAssignmentForm scope", () => {
  it("shows the workspace field only for a workspace-scoped assignment", async () => {
    renderCreate();

    selectOption("spec.global", "role_assignments.options.workspace");
    await waitFor(() => expect(isHidden(workspaceField())).toBe(false));

    selectOption("spec.global", "role_assignments.options.global");
    await waitFor(() => expect(isHidden(workspaceField())).toBe(true));
  });

  it("clears the workspace when switching to global", async () => {
    const { result } = renderCreate();
    selectOption("spec.global", "role_assignments.options.workspace");
    result.current.form.setValue("spec.workspace", "team-a");

    selectOption("spec.global", "role_assignments.options.global");

    await waitFor(() =>
      expect(result.current.form.getValues("spec.workspace")).toBeFalsy(),
    );
  });

  it("is global without the multi-workspace license", () => {
    vi.mocked(useLicense).mockReturnValue({
      supportMultiWorkspace: false,
    } as ReturnType<typeof useLicense>);
    renderCreate();

    expect(isHidden(workspaceField())).toBe(true);
  });
});
