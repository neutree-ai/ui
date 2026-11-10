import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/foundation/components/ShowButton", () => ({
  ShowButton: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}));

import { RoleAssignmentScopeLabel } from "./RoleAssignmentScopeLabel";

const base = { user_id: "u-1", role: "viewer" };

describe("RoleAssignmentScopeLabel", () => {
  it("shows a global assignment", () => {
    render(
      <RoleAssignmentScopeLabel
        spec={{ ...base, global: true, workspace: null, org_unit: null }}
      />,
    );
    expect(screen.getByTestId("role-assignment-scope").textContent).toBe(
      "role_assignments.options.global",
    );
  });

  it("shows the workspace", () => {
    render(
      <RoleAssignmentScopeLabel
        spec={{ ...base, global: false, workspace: "ws-1", org_unit: null }}
      />,
    );
    expect(screen.getByTestId("role-assignment-scope").textContent).toBe(
      "role_assignments.scope.workspacews-1",
    );
  });

  it("shows the department through the page's renderer", () => {
    render(
      <RoleAssignmentScopeLabel
        spec={{ ...base, global: false, workspace: null, org_unit: "rnd" }}
        renderOrgUnit={(name) => `R&D (${name})`}
      />,
    );
    expect(screen.getByTestId("role-assignment-scope").textContent).toBe(
      "role_assignments.scope.orgUnitR&D (rnd)",
    );
  });
});
