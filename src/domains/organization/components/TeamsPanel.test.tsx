import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentProps, ReactElement, ReactNode } from "react";
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

// The menu renders flat, so a test picks an item without opening it.
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
    "data-testid": testId,
  }: {
    children: ReactNode;
    onSelect: () => void;
    "data-testid"?: string;
  }) => (
    <button type="button" onClick={onSelect} data-testid={testId}>
      {children}
    </button>
  ),
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

const Panel = (props: Partial<ComponentProps<typeof TeamsPanel>>) => (
  <TeamsPanel
    renderRoleAssignments={() => null}
    renderTeamDetail={(_, members) => members}
    useDeleteCheck={() => undefined}
    {...props}
  />
);

describe("TeamsPanel", () => {
  it("marks each team with its source", () => {
    grant();
    render(<Panel />);
    expect(screen.getByTestId("team-1").textContent).toContain("corp");
    expect(screen.getByTestId("team-2").textContent).toContain(
      "organization.values.manualTeam",
    );
  });

  it("offers create only with team:create", () => {
    grant();
    const { unmount } = render(<Panel />);
    expect(screen.queryByTestId("team-create")).toBeNull();
    unmount();
    grant("team:create");
    render(<Panel />);
    screen.getByTestId("team-create");
  });

  it("keeps a synced team read-only", () => {
    grant(...ALL);
    render(<Panel />);
    fireEvent.click(screen.getByTestId("team-1"));
    screen.getByText("organization.teams.syncedSource:corp");
    expect(screen.queryByTestId("team-edit")).toBeNull();
    expect(screen.queryByTestId("team-delete")).toBeNull();
    expect(screen.queryByTestId("team-add-members")).toBeNull();
    expect(screen.queryByTestId("team-remove-member-u-1")).toBeNull();
  });

  it("offers each action on a manual team by its permission", () => {
    grant("team:update");
    const { unmount } = render(<Panel />);
    fireEvent.click(screen.getByTestId("team-2"));
    screen.getByTestId("team-edit");
    expect(screen.queryByTestId("team-delete")).toBeNull();
    expect(screen.queryByTestId("team-add-members")).toBeNull();
    expect(screen.queryByTestId("team-remove-member-u-1")).toBeNull();
    unmount();

    grant(...ALL);
    render(<Panel />);
    fireEvent.click(screen.getByTestId("team-2"));
    screen.getByTestId("team-delete");
    screen.getByTestId("team-add-members");
    screen.getByTestId("team-remove-member-u-1");
  });

  it("deletes a manual team after confirmation", async () => {
    grant(...ALL);
    writes.remove.mockResolvedValue([manual]);
    render(<Panel />);
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
    const { unmount } = render(<Panel />);
    fireEvent.click(screen.getByTestId("team-2"));
    expect(search()).toBe("?team=guild");
    unmount();

    render(<Panel />, "/organization?tab=teams&team=guild");
    expect(screen.getByTestId("team-2").getAttribute("aria-pressed")).toBe(
      "true",
    );
    screen.getByTestId("team-delete");
  });

  it("says up front that policies block the delete, and disables it", () => {
    grant(...ALL);
    const useDeleteCheck = vi.fn((_name: string, enabled: boolean) =>
      enabled
        ? { roleAssignments: 2, hasPolicy: true, isLoading: false }
        : undefined,
    );
    render(<Panel useDeleteCheck={useDeleteCheck} />, "/o?team=guild");
    expect(useDeleteCheck).toHaveBeenLastCalledWith("guild", false);
    fireEvent.click(screen.getByTestId("team-delete"));
    expect(useDeleteCheck).toHaveBeenLastCalledWith("guild", true);
    const dialog = screen.getByRole("alertdialog");
    within(dialog).getByText("organization.teams.deleteBlocked");
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
      <Panel useDeleteCheck={() => check} />,
      "/o?team=guild",
    );
    fireEvent.click(screen.getByTestId("team-delete"));
    const button = () =>
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "buttons.delete",
      }) as HTMLButtonElement;
    screen.getByTestId("team-delete-checking");
    expect(button().disabled).toBe(true);

    check = { ...check, isLoading: false };
    rerender(
      <MemoryRouter initialEntries={["/o?team=guild"]}>
        <Panel useDeleteCheck={() => check} />
      </MemoryRouter>,
    );
    screen.getByTestId("team-delete-policy");
    expect(button().disabled).toBe(false);
  });

  it("explains a delete refused for the team's role assignments", async () => {
    grant(...ALL);
    writes.remove.mockRejectedValue({ code: "10295", hint: "1" });
    render(
      <Panel
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
    render(<Panel />);
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
    render(<Panel />);
    fireEvent.click(screen.getByTestId("team-create-team"));
    fireEvent.change(screen.getByTestId("team-form-name"), {
      target: { value: "corp-0123456789ab" },
    });
    fireEvent.click(screen.getByTestId("team-form-save"));
    screen.getByText("organization.errors.reservedTeamName");
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

  it("checks the name on blur only once it was edited", () => {
    grant("team:create");
    render(<Panel />);
    fireEvent.click(screen.getByTestId("team-create-team"));
    const name = screen.getByTestId("team-form-name");
    fireEvent.blur(name);
    expect(
      screen.queryByText("organization.teams.validation.nameRequired"),
    ).toBeNull();
    fireEvent.change(name, { target: { value: "x" } });
    fireEvent.change(name, { target: { value: "" } });
    fireEvent.blur(name);
    screen.getByText("organization.teams.validation.nameRequired");
  });

  it("creates a team marked as a project", async () => {
    grant("team:create");
    writes.create.mockResolvedValue({ ...manual, id: 9 });
    render(<Panel />);
    fireEvent.click(screen.getByTestId("team-create-team"));
    screen.getByText("organization.teams.createTitle");
    fireEvent.change(screen.getByTestId("team-form-name"), {
      target: { value: "launch" },
    });
    fireEvent.click(screen.getByTestId("team-form-project"));
    screen.getByRole("heading", { name: "organization.teams.createScenario" });
    fireEvent.click(screen.getByTestId("team-form-save"));
    await waitFor(() =>
      expect(writes.create).toHaveBeenCalledWith({
        name: "launch",
        displayName: "",
        project: true,
      }),
    );
  });

  it("creates a scenario with the mark preset, which can be turned off", async () => {
    grant("team:create");
    writes.create.mockResolvedValue({ ...manual, id: 9 });
    render(<Panel />);
    fireEvent.click(screen.getByTestId("team-create-scenario"));
    screen.getByRole("heading", { name: "organization.teams.createScenario" });
    expect(
      screen.getByTestId("team-form-project").getAttribute("aria-checked"),
    ).toBe("true");
    fireEvent.change(screen.getByTestId("team-form-name"), {
      target: { value: "launch" },
    });
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
    render(<Panel />, "/o?team=guild");
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
    render(<Panel />, "/o?team=launch");
    const list = screen.getByTestId("team-list");
    expect(within(list).getAllByTestId("team-project-badge")).toHaveLength(1);
    within(screen.getByTestId("team-3")).getByTestId("team-project-badge");
    // The selected Team's header shows the mark too.
    expect(screen.getAllByTestId("team-project-badge")).toHaveLength(2);
  });

  it("shows a taken name as a readable error", async () => {
    grant("team:create");
    writes.create.mockRejectedValue({
      code: "23505",
      message: "duplicate key",
    });
    render(<Panel />);
    fireEvent.click(screen.getByTestId("team-create-team"));
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
