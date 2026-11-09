import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/foundation/components/Timestamp", () => ({
  default: ({ timestamp }: { timestamp: string }) => <span>{timestamp}</span>,
}));

// ShowPage pulls in refine's table stack; a plain section is enough here.
vi.mock("@/foundation/components/ShowPage", () => ({
  ShowPage: {
    Section: ({
      title,
      actions,
      children,
    }: Record<string, React.ReactNode>) => (
      <section>
        {title}
        {actions}
        {children}
      </section>
    ),
  },
}));

vi.mock("@/foundation/hooks/use-has-permission", () => ({
  useHasPermission: vi.fn(),
  useHasGlobalPermission: vi.fn(),
}));

vi.mock("@/domains/organization/hooks/use-organization", () => ({
  MembershipOutOfScopeError: class extends Error {},
  useOrgUnits: vi.fn(),
  useUserOrgUnit: vi.fn(),
  useUserTeams: vi.fn(),
  useAssignOrgUnit: vi.fn(),
}));

import {
  MembershipOutOfScopeError,
  useAssignOrgUnit,
  useOrgUnits,
  useUserOrgUnit,
  useUserTeams,
} from "@/domains/organization/hooks/use-organization";
import type {
  MemberProfile,
  OrgUnit,
  OrgUnitMember,
  Team,
} from "@/domains/organization/types";
import {
  useHasGlobalPermission,
  useHasPermission,
} from "@/foundation/hooks/use-has-permission";
import { UserDepartmentSection, UserTeamsSection } from "./UserOrganization";

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
  unit(3, "/1/3/", "Finance", true),
];

const profile = (labels: Record<string, string> = {}) =>
  ({
    id: "u-1",
    metadata: { name: "alice", labels },
    spec: { email: "alice@example.com" },
  }) as MemberProfile;

const membership = (orgUnit: OrgUnit, source: string | null) =>
  ({
    user_id: "u-1",
    org_unit_id: orgUnit.id,
    identity_source: source,
    assigned_at: "2026-10-01T00:00:00Z",
    org_units: orgUnit,
  }) as OrgUnitMember;

const assign = { create: vi.fn(), update: vi.fn(), remove: vi.fn() };

const decide = (permissions: string[]) => (p?: string) => ({
  allowed: !!p && permissions.includes(p),
  isLoading: false,
});

/** Grants on any scope; global grants are set apart with grantGlobal. */
const grant = (...permissions: string[]) =>
  vi.mocked(useHasPermission).mockImplementation(decide(permissions));

const grantGlobal = (...permissions: string[]) =>
  vi.mocked(useHasGlobalPermission).mockImplementation(decide(permissions));

const withMembership = (m: OrgUnitMember | null) =>
  vi.mocked(useUserOrgUnit).mockReturnValue({
    membership: m,
    isLoading: false,
    error: null,
  });

describe("UserDepartmentSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOrgUnits).mockReturnValue({
      data: { data: units, total: units.length },
    } as never);
    vi.mocked(useAssignOrgUnit).mockReturnValue({
      ...assign,
      isPending: false,
    });
    assign.create.mockResolvedValue(undefined);
    withMembership(null);
    grantGlobal();
  });

  it("is hidden without org_unit:read", () => {
    grant("org_unit:assign-member");
    const { container } = render(<UserDepartmentSection profile={profile()} />);
    expect(container.innerHTML).toBe("");
  });

  it("assigns an Active department to a local user", async () => {
    grant("org_unit:read", "org_unit:assign-member");
    grantGlobal("org_unit:assign-member");
    render(<UserDepartmentSection profile={profile()} />);
    screen.getByTestId("user-department-empty");
    expect(screen.queryByTestId("user-department-remove")).toBeNull();

    fireEvent.click(screen.getByTestId("user-department-assign"));
    // Inactive departments are not offered.
    expect(screen.queryByTestId("org-unit-3")).toBeNull();
    fireEvent.click(screen.getByTestId("org-unit-2"));
    fireEvent.click(screen.getByTestId("assign-org-unit-save"));
    await waitFor(() => expect(assign.create).toHaveBeenCalledWith(2));
    expect(assign.update).not.toHaveBeenCalled();
  });

  it("shows the reason when the assignment is refused", async () => {
    grant("org_unit:read", "org_unit:assign-member");
    grantGlobal("org_unit:assign-member");
    assign.create.mockRejectedValue({ code: "10277", message: "inactive" });
    render(<UserDepartmentSection profile={profile()} />);
    fireEvent.click(screen.getByTestId("user-department-assign"));
    fireEvent.click(screen.getByTestId("org-unit-2"));
    fireEvent.click(screen.getByTestId("assign-org-unit-save"));
    expect(
      (await screen.findByTestId("assign-org-unit-error")).textContent,
    ).toBe("organization.errors.inactiveOrgUnit");
  });

  it("changes or removes a hand assignment on a subtree grant", () => {
    grant("org_unit:read", "org_unit:assign-member");
    withMembership(membership(units[1], null));
    render(<UserDepartmentSection profile={profile()} />);
    expect(screen.getByTestId("user-department-path").textContent).toBe(
      "Corp / Engineering",
    );
    expect(screen.getByTestId("user-department-source").textContent).toBe(
      "organization.values.manual",
    );
    expect(screen.getByTestId("user-department-assign").textContent).toBe(
      "user_profiles.department.change",
    );
    screen.getByTestId("user-department-remove");
  });

  it("explains a change to a department outside the caller's", async () => {
    grant("org_unit:read", "org_unit:assign-member");
    withMembership(membership(units[1], null));
    assign.update.mockRejectedValue({ code: "42501", message: "rls" });
    render(<UserDepartmentSection profile={profile()} />);
    fireEvent.click(screen.getByTestId("user-department-assign"));
    fireEvent.click(screen.getByTestId("org-unit-1"));
    fireEvent.click(screen.getByTestId("assign-org-unit-save"));
    expect(
      (await screen.findByTestId("assign-org-unit-error")).textContent,
    ).toBe("user_profiles.department.errors.targetOutsideScope");
  });

  it("explains a change from a department outside the caller's", async () => {
    grant("org_unit:read", "org_unit:assign-member");
    withMembership(membership(units[1], null));
    assign.update.mockRejectedValue(new MembershipOutOfScopeError());
    render(<UserDepartmentSection profile={profile()} />);
    fireEvent.click(screen.getByTestId("user-department-assign"));
    fireEvent.click(screen.getByTestId("org-unit-1"));
    fireEvent.click(screen.getByTestId("assign-org-unit-save"));
    expect(
      (await screen.findByTestId("assign-org-unit-error")).textContent,
    ).toBe("user_profiles.department.errors.currentOutsideScope");
  });

  it.each([
    ["an RLS refusal", { code: "42501", message: "rls" }],
    ["no row removed", new MembershipOutOfScopeError()],
  ])("explains a remove refused by %s", async (_, cause) => {
    grant("org_unit:read", "org_unit:assign-member");
    withMembership(membership(units[1], null));
    assign.remove.mockRejectedValue(cause);
    render(<UserDepartmentSection profile={profile()} />);
    fireEvent.click(screen.getByTestId("user-department-remove"));
    fireEvent.click(await screen.findByText("buttons.delete"));
    expect(
      (await screen.findByTestId("user-department-remove-error")).textContent,
    ).toBe("user_profiles.department.errors.currentOutsideScope");
  });

  it("maps 10287 on a change", async () => {
    grant("org_unit:read", "org_unit:assign-member");
    withMembership(membership(units[1], null));
    assign.update.mockRejectedValue({ code: "10287", message: "user" });
    render(<UserDepartmentSection profile={profile()} />);
    fireEvent.click(screen.getByTestId("user-department-assign"));
    fireEvent.click(screen.getByTestId("org-unit-1"));
    fireEvent.click(screen.getByTestId("assign-org-unit-save"));
    expect(
      (await screen.findByTestId("assign-org-unit-error")).textContent,
    ).toBe("organization.errors.globalAssignerOnly");
  });

  it("offers no assignment to a user without a department on a subtree grant", () => {
    grant("org_unit:read", "org_unit:assign-member");
    render(<UserDepartmentSection profile={profile()} />);
    screen.getByTestId("user-department-empty");
    expect(screen.queryByTestId("user-department-assign")).toBeNull();
  });

  it("leaves an external user's synced department read-only", () => {
    grant("org_unit:read", "org_unit:assign-member");
    withMembership(membership(units[2], "corp"));
    render(
      <UserDepartmentSection
        profile={profile({ "neutree.ai/identity-source": "ldap" })}
      />,
    );
    expect(screen.getByTestId("user-department-source").textContent).toBe(
      "corp",
    );
    screen.getByText("organization.phases.Inactive");
    expect(screen.queryByTestId("user-department-assign")).toBeNull();
    expect(screen.queryByTestId("user-department-remove")).toBeNull();
  });

  it("offers no editing without org_unit:assign-member", () => {
    grant("org_unit:read");
    render(<UserDepartmentSection profile={profile()} />);
    screen.getByTestId("user-department-empty");
    expect(screen.queryByTestId("user-department-assign")).toBeNull();
  });
});

describe("UserTeamsSection", () => {
  const team = (id: number, name: string, inactive = false, manual = false) =>
    ({
      id,
      metadata: { name: `team-${id}`, display_name: name },
      spec: manual
        ? { identity_source: null, external_id: null }
        : { identity_source: "corp", external_id: `t${id}` },
      status: { phase: inactive ? "Inactive" : "Active" },
    }) as Team;

  beforeEach(() => {
    vi.mocked(useUserTeams).mockReturnValue({
      members: [
        {
          team_id: 2,
          user_id: "u-1",
          created_at: "",
          teams: team(2, "SRE", true),
        },
        { team_id: 1, user_id: "u-1", created_at: "", teams: team(1, "Infra") },
        {
          team_id: 3,
          user_id: "u-1",
          created_at: "",
          teams: team(3, "Guild", false, true),
        },
      ],
      isLoading: false,
      error: null,
    });
  });

  it("is hidden without a global team:read", () => {
    // A subtree grant passes the any-scope check, but the teams RLS needs a
    // global one.
    grant("org_unit:read", "team:read");
    grantGlobal("org_unit:read");
    const { container } = render(<UserTeamsSection userId="u-1" />);
    expect(container.innerHTML).toBe("");
    expect(vi.mocked(useUserTeams)).toHaveBeenLastCalledWith("u-1", false);
  });

  it("lists the user's teams by name with their source", () => {
    grantGlobal("team:read");
    render(<UserTeamsSection userId="u-1" />);
    const items = screen.getByTestId("user-teams").querySelectorAll("li");
    expect([...items].map((li) => li.textContent)).toEqual([
      "Guildorganization.values.manualTeam",
      "Infracorp",
      "SREcorporganization.phases.Inactive",
    ]);
  });
});
