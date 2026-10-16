import { render, screen } from "@testing-library/react";
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
  useHasGlobalPermission: vi.fn(),
}));

import { useHasGlobalPermission } from "@/foundation/hooks/use-has-permission";
import { OrganizationList } from "./list";

describe("OrganizationList", () => {
  it("offers the Teams tab only with a global team:read", () => {
    vi.mocked(useHasGlobalPermission).mockReturnValue({
      allowed: false,
      isLoading: false,
    });
    const { unmount } = render(<OrganizationList />);
    expect(vi.mocked(useHasGlobalPermission)).toHaveBeenCalledWith("team:read");
    expect(screen.getByTestId("departments-panel")).toBeTruthy();
    expect(screen.queryByTestId("organization-teams-tab")).toBeNull();
    unmount();

    vi.mocked(useHasGlobalPermission).mockReturnValue({
      allowed: true,
      isLoading: false,
    });
    render(<OrganizationList />);
    expect(screen.getByTestId("organization-teams-tab")).toBeTruthy();
  });
});
