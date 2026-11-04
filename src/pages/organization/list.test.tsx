import { fireEvent, render as rtlRender, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/foundation/components/ListPage", () => ({
  ListPage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/domains/organization/components/DepartmentsPanel", () => ({
  DepartmentsPanel: () => <div data-testid="departments-panel" />,
}));
vi.mock("@/domains/organization/components/TeamsPanel", () => ({
  TeamsPanel: () => <div data-testid="teams-panel" />,
}));
vi.mock("@/domains/organization/components/OrgUnitField", () => ({
  OrgUnitLabel: () => null,
}));
vi.mock("@/domains/role-assignment/components/GroupRoleAssignments", () => ({
  GroupRoleAssignments: () => null,
}));
vi.mock("@/domains/group-policy/components/GroupModelAccess", () => ({
  GroupModelAccess: () => null,
}));
vi.mock("@/foundation/hooks/use-has-permission", () => ({
  useHasPermission: vi.fn(),
}));
vi.mock("@/pages/organization/team-detail-tabs", () => ({
  TeamDetailTabs: () => null,
}));
vi.mock("@/pages/organization/use-team-delete-check", () => ({
  useTeamDeleteCheck: vi.fn(),
}));

import { useHasPermission } from "@/foundation/hooks/use-has-permission";
import { OrganizationList } from "./list";

const LocationProbe = () => (
  <output data-testid="location">{useLocation().search}</output>
);
const render = (ui: ReactElement, path = "/organization") =>
  rtlRender(
    <MemoryRouter initialEntries={[path]}>
      {ui}
      <LocationProbe />
    </MemoryRouter>,
  );

// Grants the listed permissions, in any scope.
const grant = (...permissions: string[]) =>
  vi.mocked(useHasPermission).mockImplementation((permission?: string) => ({
    allowed: permissions.includes(permission ?? ""),
    isLoading: false,
  }));

describe("OrganizationList", () => {
  it("offers the Teams tab only with team:read", () => {
    grant("org_unit:read");
    const { unmount } = render(<OrganizationList />);
    expect(vi.mocked(useHasPermission)).toHaveBeenCalledWith("team:read");
    expect(screen.getByTestId("departments-panel")).toBeTruthy();
    expect(screen.queryByTestId("organization-teams-tab")).toBeNull();
    unmount();

    grant("org_unit:read", "team:read");
    render(<OrganizationList />);
    expect(screen.getByTestId("organization-teams-tab")).toBeTruthy();
  });

  it("opens the Teams tab for a team admin who cannot read departments", () => {
    grant("team:read");
    render(<OrganizationList />);
    expect(screen.getByTestId("teams-panel")).toBeTruthy();
    expect(screen.queryByText("organization.departments.title")).toBeNull();
  });

  it("opens the tab named in the URL and records a switch", () => {
    grant("org_unit:read", "team:read");
    const { unmount } = render(
      <OrganizationList />,
      "/organization?tab=teams&team=guild",
    );
    expect(screen.getByTestId("teams-panel")).toBeTruthy();
    expect(screen.queryByTestId("departments-panel")).toBeNull();

    const departments = screen.getByText("organization.departments.title");
    fireEvent.mouseDown(departments);
    fireEvent.click(departments);
    expect(screen.getByTestId("location").textContent).toBe("?team=guild");
    unmount();

    // Without team:read the Teams tab in a link falls back to Departments.
    grant("org_unit:read");
    render(<OrganizationList />, "/organization?tab=teams");
    expect(screen.getByTestId("departments-panel")).toBeTruthy();
  });
});
