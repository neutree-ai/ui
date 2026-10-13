import { fireEvent, render, screen, within } from "@testing-library/react";
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

vi.mock("@/domains/organization/hooks/use-organization", () => ({
  useOrgUnits: vi.fn(),
  useOrgUnitMembers: vi.fn(),
}));

import {
  useOrgUnitMembers,
  useOrgUnits,
} from "@/domains/organization/hooks/use-organization";
import type { OrgUnit } from "@/domains/organization/types";
import { DepartmentsPanel } from "./DepartmentsPanel";

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
    expect(
      screen.getByText("organization.departments.fromSource:corp"),
    ).toBeTruthy();
    expect(screen.getByTestId("org-unit-2")).toBeTruthy();
    // Engineering is closed by default, and Finance is Inactive.
    expect(screen.queryByTestId("org-unit-3")).toBeNull();
    expect(screen.queryByTestId("org-unit-4")).toBeNull();

    fireEvent.click(screen.getByTestId("organization-show-inactive"));
    expect(screen.getByTestId("org-unit-4")).toBeTruthy();
  });

  it("opens every match while searching by path", () => {
    render(<DepartmentsPanel />);
    fireEvent.change(screen.getByTestId("organization-search"), {
      target: { value: "engineering / plat" },
    });
    expect(screen.getByTestId("org-unit-3")).toBeTruthy();
    expect(screen.queryByTestId("org-unit-4")).toBeNull();

    fireEvent.change(screen.getByTestId("organization-search"), {
      target: { value: "sales" },
    });
    expect(screen.getByTestId("org-units-empty").textContent).toBe(
      "organization.departments.noMatch",
    );
  });

  it("shows the members of the selected department, then of its subtree", () => {
    render(<DepartmentsPanel />);
    fireEvent.click(screen.getByTestId("org-unit-2"));
    expect(vi.mocked(useOrgUnitMembers)).toHaveBeenLastCalledWith(2, false);

    const table = screen.getByTestId("members-table");
    expect(within(table).getByText("Alice")).toBeTruthy();
    expect(within(table).getByText("organization.values.manual")).toBeTruthy();
    expect(
      within(table).queryByText("organization.fields.department"),
    ).toBeNull();

    fireEvent.click(screen.getByTestId("org-unit-include-subtree"));
    expect(vi.mocked(useOrgUnitMembers)).toHaveBeenLastCalledWith(2, true);
    expect(
      within(screen.getByTestId("members-table")).getByText(
        "Corp / Engineering",
      ),
    ).toBeTruthy();
  });
});
