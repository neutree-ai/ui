import {
  fireEvent,
  render as rtlRender,
  screen,
  within,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.source ? `${key}:${options.source}` : key,
  }),
}));

vi.mock("@/foundation/components/Timestamp", () => ({
  default: ({ timestamp }: { timestamp: string }) => <span>{timestamp}</span>,
}));

// ShowPage pulls in refine's table stack; a plain section is enough here.
vi.mock("@/foundation/components/ShowPage", () => ({
  ShowPage: {
    Section: ({
      title,
      description,
      actions,
      children,
    }: Record<string, React.ReactNode>) => (
      <section>
        {title}
        {description}
        {actions}
        {children}
      </section>
    ),
  },
}));

vi.mock("@/domains/organization/hooks/use-organization", async () => {
  const { orgTreeIndex } = await import("@/domains/organization/lib/org-tree");
  const NONE: never[] = [];
  const useOrgUnits = vi.fn();
  return {
    useOrgUnits,
    useOrgUnitMembers: vi.fn(),
    useOrgTree: (enabled?: boolean) => {
      const query = useOrgUnits(enabled);
      return {
        ...orgTreeIndex(query?.data?.data ?? NONE),
        isLoading: query?.isLoading,
        error: query?.error,
      };
    },
  };
});

import {
  useOrgUnitMembers,
  useOrgUnits,
} from "@/domains/organization/hooks/use-organization";
import type { OrgUnit } from "@/domains/organization/types";
import { DepartmentsPanel } from "./DepartmentsPanel";

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
const search = () =>
  decodeURIComponent(screen.getByTestId("location").textContent ?? "");

const unit = (id: number, path: string, name: string, inactive = false) =>
  ({
    id,
    metadata: { name: `ou-${id}`, display_name: name },
    spec: { identity_source: "corp", external_id: `x${id}` },
    status: { phase: inactive ? "Inactive" : "Active" },
    path,
  }) as OrgUnit;

const units = [
  unit(1, "/1/", "Corp"),
  unit(2, "/1/2/", "Engineering"),
  unit(3, "/1/2/3/", "Platform"),
  unit(4, "/1/4/", "Finance", true),
];

describe("DepartmentsPanel", () => {
  beforeEach(() => {
    vi.mocked(useOrgUnits).mockReturnValue({
      data: { data: units, total: units.length },
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(useOrgUnitMembers).mockReturnValue({
      members: [
        {
          user_id: "u-1",
          org_unit_id: 2,
          identity_source: null,
          assigned_at: "2026-10-01T00:00:00Z",
          user_profiles: {
            id: "u-1",
            metadata: { name: "alice", display_name: "Alice" },
            spec: { email: "alice@example.com" },
          },
        },
      ],
      isLoading: false,
      error: null,
    } as never);
  });

  it("groups by identity source, opens the roots and hides Inactive departments", () => {
    render(<DepartmentsPanel />);
    screen.getByText("organization.departments.fromSource:corp");
    screen.getByTestId("org-unit-2");
    // Engineering is closed by default, and Finance is Inactive.
    expect(screen.queryByTestId("org-unit-3")).toBeNull();
    expect(screen.queryByTestId("org-unit-4")).toBeNull();

    fireEvent.click(screen.getByTestId("organization-show-inactive"));
    screen.getByTestId("org-unit-4");
  });

  it("opens every match while searching by path", () => {
    render(<DepartmentsPanel />);
    fireEvent.change(screen.getByTestId("organization-search"), {
      target: { value: "engineering / plat" },
    });
    screen.getByTestId("org-unit-3");
    expect(screen.queryByTestId("org-unit-4")).toBeNull();

    fireEvent.change(screen.getByTestId("organization-search"), {
      target: { value: "sales" },
    });
    expect(screen.getByTestId("org-units-empty").textContent).toBe(
      "organization.departments.noMatch",
    );
  });

  it("keeps the selection and the expanded nodes in the URL", () => {
    const { unmount } = render(<DepartmentsPanel />);
    fireEvent.click(screen.getByTestId("org-unit-2"));
    expect(search()).toBe("?department=ou-2");
    fireEvent.click(screen.getByTestId("org-unit-toggle-2"));
    expect(search()).toBe("?department=ou-2&expanded=ou-1&expanded=ou-2");
    unmount();

    // A shared link to a deep department opens the way down to it.
    render(<DepartmentsPanel />, "/organization?department=ou-3");
    screen.getByTestId("org-unit-3");
    expect(vi.mocked(useOrgUnitMembers)).toHaveBeenLastCalledWith(3, false);
  });

  it("shows the members of the selected department, then of its subtree", () => {
    render(<DepartmentsPanel />);
    fireEvent.click(screen.getByTestId("org-unit-2"));
    expect(vi.mocked(useOrgUnitMembers)).toHaveBeenLastCalledWith(2, false);

    const table = screen.getByTestId("members-table");
    within(table).getByText("Alice");
    within(table).getByText("organization.values.manual");
    expect(
      within(table).queryByText("organization.fields.department"),
    ).toBeNull();

    fireEvent.click(screen.getByTestId("org-unit-include-subtree"));
    expect(vi.mocked(useOrgUnitMembers)).toHaveBeenLastCalledWith(2, true);
    within(screen.getByTestId("members-table")).getByText("Corp / Engineering");
  });
});
