import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/foundation/components/ShowButton", () => ({
  ShowButton: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}));
vi.mock("@/foundation/components/ShowPage", () => ({
  ShowPage: {
    Section: ({ title, children, ...props }: Record<string, ReactNode>) => (
      <section data-testid={props["data-testid"] as string}>
        {title}
        {children}
      </section>
    ),
  },
}));
vi.mock("@/domains/role-assignment/components/UserCell", () => ({
  default: ({ id }: { id: string }) => <span>user:{id}</span>,
}));
vi.mock("@/foundation/hooks/use-has-permission", () => ({
  useHasGlobalPermission: vi.fn(),
  useHasPermission: vi.fn(),
}));
vi.mock("@/domains/role-assignment/hooks/use-role-assignments", () => ({
  useGroupRoleAssignments: vi.fn(),
  useUserEffectiveRoleAssignments: vi.fn(),
}));

import {
  useGroupRoleAssignments,
  useUserEffectiveRoleAssignments,
} from "@/domains/role-assignment/hooks/use-role-assignments";
import type { RoleAssignment } from "@/domains/role-assignment/types";
import {
  useHasGlobalPermission,
  useHasPermission,
} from "@/foundation/hooks/use-has-permission";
import { GroupRoleAssignments } from "./GroupRoleAssignments";
import { RoleAssignmentSubjectLabel } from "./RoleAssignmentSubjectLabel";
import { UserEffectiveRoleAssignments } from "./UserEffectiveRoleAssignments";

const spec = {
  user_id: null,
  role: "viewer",
  global: true,
  workspace: null,
  org_unit: null,
};

const grant = ({ global, any }: { global: boolean; any: boolean }) => {
  vi.mocked(useHasGlobalPermission).mockReturnValue({
    allowed: global,
    isLoading: false,
  });
  vi.mocked(useHasPermission).mockReturnValue({
    allowed: any,
    isLoading: false,
  });
};

describe("RoleAssignmentSubjectLabel", () => {
  it("reads a spec without subject_kind as a user", () => {
    render(<RoleAssignmentSubjectLabel spec={{ ...spec, user_id: "u-1" }} />);
    expect(screen.getByTestId("subject-kind-User")).toBeTruthy();
    expect(screen.getByText("user:u-1")).toBeTruthy();
  });

  it("renders a group through the page's renderer", () => {
    render(
      <RoleAssignmentSubjectLabel
        spec={{ ...spec, subject_kind: "Team", subject_name: "sre" }}
        renderTeam={(name) => `team:${name}`}
      />,
    );
    expect(screen.getByTestId("subject-kind-Team")).toBeTruthy();
    expect(screen.getByText("team:sre")).toBeTruthy();
  });
});

describe("GroupRoleAssignments", () => {
  beforeEach(() => {
    vi.mocked(useGroupRoleAssignments).mockReturnValue({
      rows: [
        {
          id: 7,
          metadata: { name: "sre-viewer" },
          spec: { ...spec, subject_kind: "Team", subject_name: "sre" },
        } as RoleAssignment,
      ],
      isLoading: false,
      error: null,
    });
  });

  it("lists a Team's assignments with a global role_assignment:read", () => {
    grant({ global: true, any: true });
    render(<GroupRoleAssignments kind="Team" name="sre" />);
    expect(useGroupRoleAssignments).toHaveBeenCalledWith("Team", "sre", true);
    expect(screen.getByText("sre-viewer")).toBeTruthy();
  });

  it("hides a Team's assignments from a subtree grant", () => {
    grant({ global: false, any: true });
    render(<GroupRoleAssignments kind="Team" name="sre" />);
    expect(screen.queryByTestId("group-role-assignments")).toBeNull();
  });

  it("shows a department's assignments to a subtree grant", () => {
    grant({ global: false, any: true });
    render(<GroupRoleAssignments kind="OrgUnit" name="rnd" />);
    expect(screen.getByTestId("group-role-assignments")).toBeTruthy();
  });
});

describe("UserEffectiveRoleAssignments", () => {
  beforeEach(() => grant({ global: true, any: true }));

  it("labels where each assignment comes from", () => {
    vi.mocked(useUserEffectiveRoleAssignments).mockReturnValue({
      rows: [
        {
          id: 1,
          name: "own",
          spec: { ...spec, user_id: "u-1", subject_kind: "User" },
          via_kind: "User",
          via_name: null,
        },
        {
          id: 2,
          name: "from-team",
          spec: { ...spec, subject_kind: "Team", subject_name: "sre" },
          via_kind: "Team",
          via_name: "sre",
        },
        {
          id: 3,
          name: "from-dept",
          spec: { ...spec, subject_kind: "OrgUnit", subject_name: "rnd" },
          via_kind: "OrgUnit",
          via_name: "rnd",
        },
      ],
      isLoading: false,
      denied: false,
      error: null,
    });
    render(
      <UserEffectiveRoleAssignments
        userId="u-1"
        renderTeam={(name) => `team:${name}`}
        renderOrgUnit={(name) => `dept:${name}`}
      />,
    );
    expect(screen.getByTestId("effective-source-1").textContent).toBe(
      "role_assignments.effective.direct",
    );
    expect(screen.getByTestId("effective-source-2").textContent).toBe(
      "team:sre",
    );
    expect(screen.getByTestId("effective-source-3").textContent).toBe(
      "dept:rnd",
    );
  });

  it("hides the section when the server refuses", () => {
    vi.mocked(useUserEffectiveRoleAssignments).mockReturnValue({
      rows: [],
      isLoading: false,
      denied: true,
      error: null,
    });
    render(<UserEffectiveRoleAssignments userId="u-1" />);
    expect(screen.queryByTestId("user-effective-roles-card")).toBeNull();
  });
});
