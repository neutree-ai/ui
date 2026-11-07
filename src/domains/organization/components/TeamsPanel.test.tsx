import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
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

vi.mock("@/foundation/hooks/use-has-permission", () => ({
  useHasGlobalPermission: vi.fn(),
  useHasTeamPermission: vi.fn(),
}));

vi.mock("@/domains/organization/hooks/use-organization", () => ({
  TeamWriteNoRowError: class extends Error {
    constructor(readonly target: string) {
      super(target);
    }
  },
  useTeams: vi.fn(),
  useTeamMembers: vi.fn(),
  useTeamWrites: vi.fn(),
  useTeamMemberWrites: vi.fn(),
  useAllUsers: vi.fn(),
}));

import {
  TeamWriteNoRowError,
  useTeamMembers,
  useTeamMemberWrites,
  useTeams,
  useTeamWrites,
} from "@/domains/organization/hooks/use-organization";
import type { MemberProfile, Team } from "@/domains/organization/types";
import {
  useHasGlobalPermission,
  useHasTeamPermission,
} from "@/foundation/hooks/use-has-permission";
import { TeamsPanel } from "./TeamsPanel";

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

const synced = {
  id: 1,
  metadata: { name: "corp-0123456789ab", display_name: "SRE" },
  spec: { identity_source: "corp", external_id: "g1" },
  status: { phase: "Active" },
} as Team;
const manual = {
  id: 2,
  metadata: { name: "guild", display_name: "Guild" },
  spec: { identity_source: null, external_id: null },
  status: { phase: "Active" },
} as Team;

const writes = {
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  isPending: false,
};
const memberWrites = { add: vi.fn(), remove: vi.fn(), isPending: false };

// A global grant also holds on every Team, as has_permission_on_team decides.
const grant = (...permissions: string[]) => {
  vi.mocked(useHasGlobalPermission).mockImplementation((permission) => ({
    allowed: permissions.includes(permission ?? ""),
    isLoading: false,
  }));
  vi.mocked(useHasTeamPermission).mockImplementation((permission, teamId) => ({
    allowed: teamId !== undefined && permissions.includes(permission),
    isLoading: false,
  }));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useTeams).mockReturnValue({
    data: { data: [synced, manual], total: 2 },
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useTeams>);
  vi.mocked(useTeamMembers).mockReturnValue({
    members: [
      {
        team_id: 2,
        user_id: "u-1",
        created_at: "",
        user_profiles: {
          id: "u-1",
          metadata: { name: "alice" },
        } as MemberProfile,
      },
    ],
    isLoading: false,
    error: null,
  });
  vi.mocked(useTeamWrites).mockReturnValue(writes);
  vi.mocked(useTeamMemberWrites).mockReturnValue(memberWrites);
});

const ALL = ["team:create", "team:update", "team:delete", "team:assign-member"];

describe("TeamsPanel", () => {
  it("marks each team with its source", () => {
    grant();
    render(<TeamsPanel />);
    expect(screen.getByTestId("team-1").textContent).toContain("corp");
    expect(screen.getByTestId("team-2").textContent).toContain(
      "organization.values.manualTeam",
    );
  });

  it("offers create only with team:create", () => {
    grant();
    const { unmount } = render(<TeamsPanel />);
    expect(screen.queryByTestId("team-create")).toBeNull();
    unmount();
    grant("team:create");
    render(<TeamsPanel />);
    expect(screen.getByTestId("team-create")).toBeTruthy();
  });

  it("keeps a synced team read-only", () => {
    grant(...ALL);
    render(<TeamsPanel />);
    fireEvent.click(screen.getByTestId("team-1"));
    expect(
      screen.getByText("organization.teams.syncedSource:corp"),
    ).toBeTruthy();
    expect(screen.queryByTestId("team-edit")).toBeNull();
    expect(screen.queryByTestId("team-delete")).toBeNull();
    expect(screen.queryByTestId("team-add-members")).toBeNull();
    expect(screen.queryByTestId("team-remove-member-u-1")).toBeNull();
  });

  it("offers each action on a manual team by its permission", () => {
    grant("team:update");
    const { unmount } = render(<TeamsPanel />);
    fireEvent.click(screen.getByTestId("team-2"));
    expect(screen.getByTestId("team-edit")).toBeTruthy();
    expect(screen.queryByTestId("team-delete")).toBeNull();
    expect(screen.queryByTestId("team-add-members")).toBeNull();
    expect(screen.queryByTestId("team-remove-member-u-1")).toBeNull();
    unmount();

    grant(...ALL);
    render(<TeamsPanel />);
    fireEvent.click(screen.getByTestId("team-2"));
    expect(screen.getByTestId("team-delete")).toBeTruthy();
    expect(screen.getByTestId("team-add-members")).toBeTruthy();
    expect(screen.getByTestId("team-remove-member-u-1")).toBeTruthy();
  });

  it("deletes a manual team after confirmation", async () => {
    grant(...ALL);
    writes.remove.mockResolvedValue([manual]);
    render(<TeamsPanel />);
    fireEvent.click(screen.getByTestId("team-2"));
    fireEvent.click(screen.getByTestId("team-delete"));
    expect(writes.remove).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "buttons.delete",
      }),
    );
    await waitFor(() => expect(writes.remove).toHaveBeenCalledWith(manual));
  });

  it("keeps the selected team in the URL and restores it from there", () => {
    grant(...ALL);
    const { unmount } = render(<TeamsPanel />);
    fireEvent.click(screen.getByTestId("team-2"));
    expect(search()).toBe("?team=guild");
    unmount();

    render(<TeamsPanel />, "/organization?tab=teams&team=guild");
    expect(screen.getByTestId("team-2").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByTestId("team-delete")).toBeTruthy();
  });

  it("says up front that policies block the delete, and disables it", () => {
    grant(...ALL);
    const useDeleteCheck = vi.fn((_name: string, enabled: boolean) =>
      enabled
        ? { roleAssignments: 2, hasPolicy: true, isLoading: false }
        : undefined,
    );
    render(<TeamsPanel useDeleteCheck={useDeleteCheck} />, "/o?team=guild");
    expect(useDeleteCheck).toHaveBeenLastCalledWith("guild", false);
    fireEvent.click(screen.getByTestId("team-delete"));
    expect(useDeleteCheck).toHaveBeenLastCalledWith("guild", true);
    const dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByText("organization.teams.deleteBlocked"),
    ).toBeTruthy();
    const confirm = within(dialog).getByRole("button", {
      name: "buttons.delete",
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(writes.remove).not.toHaveBeenCalled();
  });

  it("waits for the check, then notes the policy deleted with the team", () => {
    grant(...ALL);
    let check = { roleAssignments: 0, hasPolicy: true, isLoading: true };
    const { rerender } = render(
      <TeamsPanel useDeleteCheck={() => check} />,
      "/o?team=guild",
    );
    fireEvent.click(screen.getByTestId("team-delete"));
    const button = () =>
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "buttons.delete",
      }) as HTMLButtonElement;
    expect(screen.getByTestId("team-delete-checking")).toBeTruthy();
    expect(button().disabled).toBe(true);

    check = { ...check, isLoading: false };
    rerender(
      <MemoryRouter initialEntries={["/o?team=guild"]}>
        <TeamsPanel useDeleteCheck={() => check} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("team-delete-policy")).toBeTruthy();
    expect(button().disabled).toBe(false);
  });

  it("explains a delete refused for the team's role assignments", async () => {
    grant(...ALL);
    writes.remove.mockRejectedValue({ code: "10295", hint: "1" });
    render(
      <TeamsPanel
        renderRoleAssignments={(name) => (
          <div data-testid="team-role-assignments">{name}</div>
        )}
      />,
    );
    fireEvent.click(screen.getByTestId("team-2"));
    expect(screen.getByTestId("team-role-assignments").textContent).toBe(
      "guild",
    );
    fireEvent.click(screen.getByTestId("team-delete"));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "buttons.delete",
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("team-action-error").textContent).toBe(
        "organization.errors.teamHasRoleAssignments",
      ),
    );
  });

  it("explains a removal that changed no row", async () => {
    grant(...ALL);
    memberWrites.remove.mockRejectedValue(new TeamWriteNoRowError("member"));
    render(<TeamsPanel />);
    fireEvent.click(screen.getByTestId("team-2"));
    fireEvent.click(screen.getByTestId("team-remove-member-u-1"));
    fireEvent.click(
      screen.getByText("organization.teams.removeMember", {
        selector: "button",
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("team-action-error").textContent).toBe(
        "organization.teams.errors.memberGone",
      ),
    );
    expect(memberWrites.remove).toHaveBeenCalledWith("u-1");
  });

  it("creates a team and refuses a reserved name before sending", async () => {
    grant("team:create");
    writes.create.mockResolvedValue({ ...manual, id: 9 });
    render(<TeamsPanel />);
    fireEvent.click(screen.getByTestId("team-create"));
    fireEvent.change(screen.getByTestId("team-form-name"), {
      target: { value: "corp-0123456789ab" },
    });
    fireEvent.click(screen.getByTestId("team-form-save"));
    expect(
      screen.getByText("organization.errors.reservedTeamName"),
    ).toBeTruthy();
    expect(writes.create).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("team-form-name"), {
      target: { value: "guild-2" },
    });
    fireEvent.change(screen.getByTestId("team-form-display-name"), {
      target: { value: "Guild 2" },
    });
    fireEvent.click(screen.getByTestId("team-form-save"));
    await waitFor(() =>
      expect(writes.create).toHaveBeenCalledWith({
        name: "guild-2",
        displayName: "Guild 2",
        project: false,
      }),
    );
  });

  it("creates a team marked as a project", async () => {
    grant("team:create");
    writes.create.mockResolvedValue({ ...manual, id: 9 });
    render(<TeamsPanel />);
    fireEvent.click(screen.getByTestId("team-create"));
    fireEvent.change(screen.getByTestId("team-form-name"), {
      target: { value: "launch" },
    });
    fireEvent.click(screen.getByTestId("team-form-project"));
    fireEvent.click(screen.getByTestId("team-form-save"));
    await waitFor(() =>
      expect(writes.create).toHaveBeenCalledWith({
        name: "launch",
        displayName: "",
        project: true,
      }),
    );
  });

  it("toggles the project mark of a team in the edit dialog", async () => {
    grant(...ALL);
    writes.update.mockResolvedValue([manual]);
    render(<TeamsPanel />, "/o?team=guild");
    fireEvent.click(screen.getByTestId("team-edit"));
    expect(screen.getByTestId("team-form-save")).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(screen.getByTestId("team-form-project"));
    fireEvent.click(screen.getByTestId("team-form-save"));
    await waitFor(() =>
      expect(writes.update).toHaveBeenCalledWith(manual, {
        name: "guild",
        displayName: "Guild",
        project: true,
      }),
    );
  });

  it("marks project teams in the list and the header", () => {
    const project = {
      ...manual,
      id: 3,
      metadata: {
        name: "launch",
        display_name: "Launch",
        labels: { "neutree.ai/team-kind": "project" },
      },
    } as unknown as Team;
    vi.mocked(useTeams).mockReturnValue({
      data: { data: [synced, manual, project], total: 3 },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useTeams>);
    render(<TeamsPanel />, "/o?team=launch");
    const list = screen.getByTestId("team-list");
    expect(within(list).getAllByTestId("team-project-badge")).toHaveLength(1);
    expect(
      within(screen.getByTestId("team-3")).getByTestId("team-project-badge"),
    ).toBeTruthy();
    // The selected Team's header shows the mark too.
    expect(screen.getAllByTestId("team-project-badge")).toHaveLength(2);
  });

  it("shows a taken name as a readable error", async () => {
    grant("team:create");
    writes.create.mockRejectedValue({
      code: "23505",
      message: "duplicate key",
    });
    render(<TeamsPanel />);
    fireEvent.click(screen.getByTestId("team-create"));
    fireEvent.change(screen.getByTestId("team-form-name"), {
      target: { value: "guild" },
    });
    fireEvent.click(screen.getByTestId("team-form-save"));
    await waitFor(() =>
      expect(screen.getByTestId("team-form-error").textContent).toBe(
        "organization.teams.errors.nameTaken",
      ),
    );
  });
});
