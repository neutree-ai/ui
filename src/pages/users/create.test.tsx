import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notify: vi.fn(),
  createMembership: vi.fn(),
  createTeamMemberships: vi.fn(),
  canAssign: true,
  canAssignTeams: true,
  options: undefined as
    | {
        departmentField?: unknown;
        teamsField?: unknown;
        onCreated: (user: {
          id: string;
          orgUnit: string;
          teams: string[];
        }) => Promise<void>;
      }
    | undefined,
}));

vi.mock("@refinedev/core", () => ({
  useNotification: () => ({ open: mocks.notify }),
}));
vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { teams?: string }) =>
      options?.teams ? `${key}|${options.teams}` : key,
  }),
}));
vi.mock("@/foundation/hooks/use-has-permission", () => ({
  useHasGlobalPermission: (permission: string) => ({
    allowed:
      permission === "team:assign-member"
        ? mocks.canAssignTeams
        : mocks.canAssign,
    isLoading: false,
  }),
}));
vi.mock("@/domains/organization/hooks/use-organization", () => ({
  useOrgTree: () => ({ byName: new Map([["eng", { unit: { id: 7 } }]]) }),
  useCreateOrgUnitMembership: () => mocks.createMembership,
  useCreateTeamMemberships: () => mocks.createTeamMemberships,
  useTeamsByName: () => ({
    byName: new Map([
      ["guild", { id: 2, metadata: { name: "guild", display_name: "Guild" } }],
      ["launch", { id: 3, metadata: { name: "launch" } }],
    ]),
  }),
}));
vi.mock("@/domains/organization/components/ManualTeamsField", () => ({
  ManualTeamsField: () => null,
}));
vi.mock("@/domains/organization/components/OrgUnitField", () => ({
  OrgUnitField: () => null,
}));
vi.mock("@/domains/user/hooks/use-user-form", () => ({
  useUserForm: (options: typeof mocks.options) => {
    mocks.options = options;
    return { form: {}, registerFields: null };
  },
}));
vi.mock("@/foundation/scene/ResourceForm", () => ({
  ResourceForm: () => null,
}));

import { UsersCreate } from "./create";

describe("UsersCreate", () => {
  beforeEach(() => {
    mocks.canAssign = true;
    mocks.canAssignTeams = true;
    mocks.notify.mockReset();
    mocks.createMembership.mockReset();
    mocks.createTeamMemberships.mockReset();
    mocks.createTeamMemberships.mockResolvedValue([]);
  });

  it("offers the department only with a global assign-member grant", () => {
    render(<UsersCreate />);
    expect(mocks.options?.departmentField).toBeTruthy();

    mocks.canAssign = false;
    render(<UsersCreate />);
    expect(mocks.options?.departmentField).toBeUndefined();
  });

  it("puts the created user into the chosen department", async () => {
    render(<UsersCreate />);
    await mocks.options?.onCreated({ id: "u-1", orgUnit: "eng", teams: [] });
    expect(mocks.createMembership).toHaveBeenCalledWith("u-1", 7);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("does nothing when no department is chosen", async () => {
    render(<UsersCreate />);
    await mocks.options?.onCreated({ id: "u-1", orgUnit: "", teams: [] });
    expect(mocks.createMembership).not.toHaveBeenCalled();
  });

  it("reports a failed assignment without undoing the user", async () => {
    mocks.createMembership.mockRejectedValue(new Error("denied"));
    render(<UsersCreate />);
    await mocks.options?.onCreated({ id: "u-1", orgUnit: "eng", teams: [] });
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        message: "user_profiles.department.errors.createdNotAssigned",
      }),
    );
  });

  it("offers the Teams only with a global team assign-member grant", () => {
    render(<UsersCreate />);
    expect(mocks.options?.teamsField).toBeTruthy();

    mocks.canAssignTeams = false;
    render(<UsersCreate />);
    expect(mocks.options?.teamsField).toBeUndefined();
  });

  it("adds the created user to the chosen Teams, department or not", async () => {
    render(<UsersCreate />);
    await mocks.options?.onCreated({
      id: "u-1",
      orgUnit: "",
      teams: ["guild", "launch"],
    });
    expect(mocks.createTeamMemberships).toHaveBeenCalledWith("u-1", [2, 3]);
    expect(mocks.createMembership).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("adds no Team without the grant", async () => {
    mocks.canAssignTeams = false;
    render(<UsersCreate />);
    await mocks.options?.onCreated({
      id: "u-1",
      orgUnit: "",
      teams: ["guild"],
    });
    expect(mocks.createTeamMemberships).not.toHaveBeenCalled();
  });

  it("names the Teams that refused the user, keeping the user", async () => {
    mocks.createTeamMemberships.mockResolvedValue([
      { teamId: 3, cause: new Error("denied") },
    ]);
    render(<UsersCreate />);
    await mocks.options?.onCreated({
      id: "u-1",
      orgUnit: "eng",
      teams: ["guild", "launch"],
    });
    // The department went through; only the refused Team is reported.
    expect(mocks.createMembership).toHaveBeenCalledWith("u-1", 7);
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        message: "user_profiles.teams.errors.createdNotAssigned|launch",
      }),
    );
  });
});
