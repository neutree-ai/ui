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
vi.mock("@/foundation/hooks/use-has-permission", () => ({
  useHasPermission: vi.fn(),
}));

import { useHasPermission } from "@/foundation/hooks/use-has-permission";
import { OrganizationList } from "./list";

describe("OrganizationList", () => {
  it("offers the Teams tab only with team:read", () => {
    vi.mocked(useHasPermission).mockReturnValue({
      allowed: false,
      isLoading: false,
    });
    const { unmount } = render(<OrganizationList />);
    expect(vi.mocked(useHasPermission)).toHaveBeenCalledWith("team:read");
    expect(screen.getByTestId("departments-panel")).toBeTruthy();
    expect(screen.queryByTestId("organization-teams-tab")).toBeNull();
    unmount();

    vi.mocked(useHasPermission).mockReturnValue({
      allowed: true,
      isLoading: false,
    });
    render(<OrganizationList />);
    expect(screen.getByTestId("organization-teams-tab")).toBeTruthy();
  });
});
