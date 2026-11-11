import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KeyUsageGroup } from "@/domains/api-key/hooks/use-workspace-usage";
import type {
  ApiUsageRecord,
  GroupUsageKind,
  GroupUsageRecord,
} from "@/domains/api-key/types";
import type { OrgUnit, Team } from "@/domains/organization/types";
import { ModelUsageList } from "@/pages/model-usage/list";

const renderPage = (url = "/") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ModelUsageList />
    </MemoryRouter>,
  );

// Page wiring: which usage the page asks for in each scope, and that every
// panel shows that scope. The breakdown arithmetic is covered in
// lib/usage-scope.test.ts.
const translate = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}(${Object.values(options).join(",")})` : key;

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: translate }),
}));

vi.mock("@refinedev/core", () => ({
  useParsed: () => ({ params: { workspace: "default" } }),
}));

// The chart library measures itself, which jsdom cannot do. A chart that
// accepts clicks offers a button that picks a day, as clicking a bar does.
vi.mock("recharts", () => {
  const passthrough = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const Chart = ({
    children,
    onClick,
  }: {
    children?: ReactNode;
    onClick?: (state: { activeLabel?: string }) => void;
  }) => (
    <div>
      {onClick ? (
        <button
          type="button"
          onClick={() => onClick({ activeLabel: "2026-10-20" })}
        >
          pick-day
        </button>
      ) : null}
      {children}
    </div>
  );
  return {
    Bar: passthrough,
    BarChart: Chart,
    CartesianGrid: passthrough,
    Cell: passthrough,
    Legend: () => null,
    Line: passthrough,
    LineChart: Chart,
    ResponsiveContainer: passthrough,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});

vi.mock("@/foundation/components/ListPage", () => ({
  ListPage: ({
    children,
    extra,
  }: {
    children?: ReactNode;
    extra?: ReactNode;
  }) => (
    <main>
      {extra}
      {children}
    </main>
  ),
}));

vi.mock("@/foundation/components/DateRangePicker", async () => {
  const actual = await vi.importActual<
    typeof import("@/foundation/components/DateRangePicker")
  >("@/foundation/components/DateRangePicker");
  return { ...actual, DateRangePicker: () => null };
});

let canReadAll = false;
let canReadSubtree = false;
// The Teams whose usage the caller reads through a Team-scoped grant.
let usageTeamIds: number[] = [];
vi.mock("@/foundation/hooks/use-has-permission", () => ({
  useHasGlobalPermission: () => ({ allowed: canReadAll, isLoading: false }),
  useHasPermission: () => ({ allowed: canReadSubtree, isLoading: false }),
}));

// rnd ── ml, and market.
const orgUnits = [
  { id: 1, path: "/1/", metadata: { name: "rnd", display_name: "R&D" } },
  { id: 2, path: "/1/2/", metadata: { name: "ml", display_name: "ML" } },
  { id: 3, path: "/3/", metadata: { name: "market", display_name: "Market" } },
].map((u) => ({ ...u, spec: { identity_source: "ldap" } }));
vi.mock("@/domains/organization/hooks/use-organization", async () => {
  const { orgTreeIndex, teamIndex } = await import(
    "@/domains/organization/lib/org-tree"
  );
  return {
    useOrgTree: (enabled: boolean) =>
      orgTreeIndex(enabled ? (orgUnits as OrgUnit[]) : []),
    // As get_readable_usage_teams: every Team for a global reader.
    useReadableUsageTeams: () =>
      teamIndex(
        (canReadAll
          ? teams
          : teams.filter((team) =>
              usageTeamIds.includes(team.id),
            )) as unknown as Team[],
      ),
    // rnd's direct members: u2, and u5 who used nothing. Team A: u1.
    useOrgUnitMembers: (id: number | undefined) => ({
      members: id === 1 ? [member("u2", "u2-name"), member("u5", "Idle")] : [],
    }),
    useTeamMembers: (id: number | undefined) => ({
      members: id === 7 ? [member("u1", "u1-name")] : [],
    }),
  };
});

const teams = [
  { id: 7, metadata: { name: "team-a", display_name: "Team A" } },
  { id: 8, metadata: { name: "team-b", display_name: "Team B" } },
  {
    id: 9,
    metadata: {
      name: "launch",
      display_name: "Launch",
      labels: { "neutree.ai/team-kind": "project" },
    },
  },
];
const member = (id: string, name: string) => ({
  user_id: id,
  user_profiles: { id, metadata: { name } },
});

const group = (
  kind: GroupUsageKind,
  name: string,
  usage: number,
  model = "qwen",
): GroupUsageRecord => ({
  date: "2026-10-20",
  kind,
  name,
  display_name: `${name}-name`,
  workspace: "default",
  endpoint_type: "endpoint",
  endpoint_name: "chat",
  model_name: model,
  requests: usage / 10,
  usage,
  prompt_tokens: usage * 0.8,
  completion_tokens: usage * 0.2,
});

type Filter = {
  orgUnit?: string;
  team?: string;
  name?: string;
  direct?: boolean;
};

// What get_usage_by_group answers. u1 used qwen in ml, u2 llama in rnd
// itself, u3 qwen in no department; Team A's application sa1 used qwen.
const answer = (kind: GroupUsageKind, filter: Filter): GroupUsageRecord[] => {
  const key = `${kind}:${filter.orgUnit ?? filter.team ?? ""}${filter.direct ? ":direct" : ""}`;
  const answers: Record<string, GroupUsageRecord[]> = {
    "User:": [
      group("User", "u1", 300),
      group("User", "u2", 100, "llama"),
      group("User", "u3", 50),
    ],
    "OrgUnit:": [
      group("OrgUnit", "rnd", 300),
      group("OrgUnit", "rnd", 100, "llama"),
      group("OrgUnit", "ml", 300),
    ],
    "User:rnd": [group("User", "u1", 300), group("User", "u2", 100, "llama")],
    "OrgUnit:rnd": [
      group("OrgUnit", "rnd", 300),
      group("OrgUnit", "rnd", 100, "llama"),
      group("OrgUnit", "ml", 300),
    ],
    "User::direct": [group("User", "u3", 50)],
    "User:rnd:direct": [group("User", "u2", 100, "llama")],
    "Team:": [group("Team", "team-a", 250)],
    "Team:rnd": [group("Team", "team-a", 250)],
    // u1's usage while in Team A, part of their 300.
    "User:team-a": [group("User", "u1", 120)],
    "ServiceAccount:": [group("ServiceAccount", "sa1", 80)],
    "ServiceAccount:team-a": [group("ServiceAccount", "sa1", 30)],
  };
  const rows = answers[key] ?? [];
  return filter.name ? rows.filter((r) => r.name === filter.name) : rows;
};

const groupCalls: string[] = [];
const refetch = vi.fn();
const query = (usageData: unknown[]) => ({
  usageData,
  isLoading: false,
  error: null,
  refetch,
});

vi.mock("@/domains/api-key/hooks/use-group-usage", () => ({
  useGroupUsage: (
    workspace: string | undefined,
    _start: string,
    _end: string,
    kind: GroupUsageKind,
    filters: Filter[],
    enabled = true,
  ) => {
    if (!workspace || !enabled) return query([]);
    for (const filter of filters) {
      groupCalls.push(`${kind}:${JSON.stringify(filter)}`);
    }
    return query(filters.flatMap((filter) => answer(kind, filter)));
  },
}));

const keyRow = (
  id: string,
  usage: number,
  name: string | null = id,
): ApiUsageRecord => ({
  date: "2026-10-20",
  api_key_id: id,
  api_key_name: name,
  endpoint_type: "endpoint",
  endpoint_name: "chat",
  model_name: "qwen",
  workspace: "default",
  usage,
  prompt_tokens: usage * 0.8,
  completion_tokens: usage * 0.2,
});
let keyFetched = false;
const keyGroups: (KeyUsageGroup | undefined)[] = [];
vi.mock("@/domains/api-key/hooks/use-workspace-usage", () => ({
  useWorkspaceUsage: (
    workspace: string | undefined,
    _start: string,
    _end: string,
    enabled = true,
    group?: KeyUsageGroup,
  ) => {
    const fetched = !!workspace && enabled;
    keyFetched ||= fetched;
    if (fetched) keyGroups.push(group);
    // A group's usage includes a member's key that was deleted since.
    const rows = group
      ? [keyRow("key-a", 70), keyRow("0123abcd-dead-key", 20, null)]
      : [keyRow("key-a", 70), keyRow("key-b", 30)];
    return query(fetched ? rows : []);
  },
}));

beforeEach(() => {
  canReadAll = false;
  canReadSubtree = false;
  usageTeamIds = [];
  keyFetched = false;
  keyGroups.length = 0;
  groupCalls.length = 0;
  refetch.mockClear();
});

const summary = (card: string) =>
  screen.getByTestId(`usage-summary-${card}`).textContent;

const tabs = () => screen.getAllByRole("tab").map((tab) => tab.textContent);

const openTab = (label: string) =>
  fireEvent.mouseDown(screen.getByRole("tab", { name: label }), { button: 0 });

const tableRows = () =>
  Array.from(
    screen.getByRole("tabpanel").querySelectorAll("tbody tr"),
    (row) => row.querySelector("td")?.textContent,
  );

const scopeButton = (name: string) =>
  within(screen.getByRole("complementary")).getByRole("button", { name });

describe("a reader of their own API keys", () => {
  it("counts the keys, with no scope to pick", () => {
    renderPage();

    expect(keyFetched).toBe(true);
    expect(groupCalls).toEqual([]);
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(summary("total")).toContain("100");
    // Key usage carries no request count.
    expect(screen.queryByTestId("usage-summary-requests")).toBeNull();
    expect(tabs()).toEqual([
      "model_usage.tabs.apiKeys",
      "model_usage.tabs.detail",
    ]);
    expect(tableRows()).toEqual(["key-a", "key-b"]);
  });
});

describe("a reader of the whole platform", () => {
  beforeEach(() => {
    canReadAll = true;
  });

  it("opens on the platform, by department, with its applications", () => {
    renderPage();

    expect(groupCalls).toContain("User:{}");
    expect(groupCalls).toContain("ServiceAccount:{}");
    expect(groupCalls).toContain("OrgUnit:{}");
    expect(groupCalls).toContain('User:{"direct":true}');
    expect(summary("total")).toContain("530");
    expect(summary("requests")).toContain("53");
    expect(summary("requests")).toContain("model_usage.summary.activity(3,1)");
    expect(tabs()).toEqual([
      "model_usage.tabs.departments",
      "model_usage.tabs.teams",
      "model_usage.tabs.apiKeys",
      "model_usage.tabs.detail",
    ]);
    expect(tableRows()).toEqual([
      "R&D",
      "model_usage.scope.applications",
      "model_usage.scope.unassigned",
    ]);
    // Key usage is fetched only for its tab.
    expect(keyFetched).toBe(false);
  });

  it("opens the platform's applications from the breakdown", () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "model_usage.scope.applications" }),
    );

    expect(summary("total")).toContain("80");
    expect(tabs()).toEqual([
      "model_usage.tabs.applications",
      "model_usage.tabs.detail",
    ]);
    expect(tableRows()).toEqual([
      "sa1-namemodel_usage.group.kinds.ServiceAccount",
    ]);
  });

  it("lists scenarios apart from Teams", () => {
    renderPage();

    const panel = within(screen.getByRole("complementary"));
    within(
      panel.getByRole("region", { name: "model_usage.scope.teams" }),
    ).getByRole("button", { name: "Team A" });
    within(
      panel.getByRole("region", { name: "model_usage.scope.scenarios" }),
    ).getByRole("button", { name: "Launch" });
  });

  it("opens the scope the URL names", () => {
    renderPage("/?team=team-a&tab=apiKey");

    expect(scopeButton("Team A").ariaPressed).toBe("true");
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe(
      "model_usage.tabs.apiKeys",
    );
    expect(keyGroups).toContainEqual({ team: "team-a" });
  });

  it("follows a department picked in the tree on every panel", () => {
    renderPage();

    fireEvent.click(scopeButton("R&D"));

    expect(groupCalls).toContain('User:{"orgUnit":"rnd"}');
    expect(groupCalls).toContain('OrgUnit:{"orgUnit":"rnd"}');
    expect(groupCalls).toContain('User:{"orgUnit":"rnd","direct":true}');
    // One query per scope, not one per child department.
    expect(groupCalls.some((call) => call.includes('"ml"'))).toBe(false);
    expect(summary("total")).toContain("400");
    expect(tabs()).toContain("model_usage.tabs.apiKeys");
    // Direct members without usage are listed too, after the rest.
    expect(tableRows()).toEqual(["ML", "u2-name", "Idle"]);

    openTab("model_usage.tabs.teams");
    expect(groupCalls).toContain('Team:{"orgUnit":"rnd"}');
    expect(tableRows()).toEqual(["team-a-name"]);
  });

  it("counts a Team picked in the panel, by member and application", () => {
    renderPage();

    fireEvent.click(scopeButton("Team A"));

    expect(groupCalls).toContain('User:{"team":"team-a"}');
    expect(groupCalls).toContain('ServiceAccount:{"team":"team-a"}');
    expect(summary("total")).toContain("150");
    expect(tabs()).toEqual([
      "model_usage.tabs.membersAndApplications",
      "model_usage.tabs.apiKeys",
      "model_usage.tabs.detail",
    ]);
    expect(tableRows()).toEqual([
      "u1-name",
      "sa1-namemodel_usage.group.kinds.ServiceAccount",
    ]);

    // Opened from the Team, a user counts their usage in the Team only.
    fireEvent.click(screen.getByRole("button", { name: "u1-name" }));
    expect(groupCalls).toContain('User:{"name":"u1","team":"team-a"}');
    expect(summary("total")).toContain("120");
  });

  it("opens a Team from the Team tab", () => {
    renderPage();
    openTab("model_usage.tabs.teams");

    fireEvent.click(screen.getByRole("button", { name: "team-a-name" }));

    expect(groupCalls).toContain('User:{"team":"team-a"}');
  });

  it("opens a user from the breakdown and leads back to the department", () => {
    renderPage();
    fireEvent.click(scopeButton("R&D"));

    fireEvent.click(screen.getByRole("button", { name: "u2-name" }));

    // Their usage recorded under R&D itself.
    expect(groupCalls).toContain(
      'User:{"name":"u2","orgUnit":"rnd","direct":true}',
    );
    expect(summary("total")).toContain("100");
    expect(tabs()).toEqual(["model_usage.tabs.detail"]);

    const crumbs = within(
      screen.getByRole("navigation", { name: "model_usage.scope.title" }),
    );
    fireEvent.click(crumbs.getByRole("button", { name: "R&D" }));
    expect(summary("total")).toContain("400");
  });

  it("narrows every panel to the model picked in the distribution", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /^llama/ }));

    expect(summary("total")).toContain("100");
    expect(tableRows()).toEqual(["R&D"]);
  });

  it("scopes the page to the day picked in the chart", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "pick-day" }));

    screen.getByText(
      "model_usage.daily.titleDayByGroup(model_usage.series.department)",
    );
  });
});

describe("a department admin", () => {
  beforeEach(() => {
    canReadSubtree = true;
  });

  it("opens on their first department, without the platform or Teams", () => {
    renderPage();

    expect(groupCalls).not.toContain("User:{}");
    expect(groupCalls).toContain('User:{"orgUnit":"market"}');
    expect(
      within(screen.getByRole("complementary")).queryByRole("button", {
        name: "model_usage.scope.platform",
      }),
    ).toBeNull();
    expect(tabs()).not.toContain("model_usage.tabs.teams");
  });

  it("lists the API keys used in their department", () => {
    renderPage();

    openTab("model_usage.tabs.apiKeys");

    expect(keyGroups).toContainEqual({ orgUnit: "market" });
    expect(tableRows()).toEqual(["key-a", "model_usage.deletedKey(0123abcd)"]);
    // The keys cover all of the department's usage.
    expect(screen.queryByTestId("usage-key-coverage-hint")).toBeNull();
  });
});

describe("a reader of one Team's usage", () => {
  beforeEach(() => {
    usageTeamIds = [7, 9];
  });

  it("opens on their first Team, and can still pick every key they read", () => {
    renderPage();

    // Teams before scenarios, as the panel lists them.
    expect(groupCalls).toContain('User:{"team":"team-a"}');
    expect(groupCalls).not.toContain('User:{"team":"launch"}');
    expect(scopeButton("Team A").ariaPressed).toBe("true");
    // Only the Teams whose usage they read.
    expect(
      within(screen.getByRole("complementary")).queryByRole("button", {
        name: "Team B",
      }),
    ).toBeNull();

    fireEvent.click(scopeButton("model_usage.scope.visible"));
    expect(scopeButton("model_usage.scope.visible").ariaPressed).toBe("true");
    expect(tabs()).toEqual([
      "model_usage.tabs.apiKeys",
      "model_usage.tabs.detail",
    ]);
  });

  it("opens on a scenario when they read no Team", () => {
    usageTeamIds = [9];
    renderPage();

    expect(groupCalls).toContain('User:{"team":"launch"}');
  });

  it("lists the Team's API keys, and says older usage has no key", () => {
    renderPage();

    openTab("model_usage.tabs.apiKeys");

    expect(keyGroups).toContainEqual({ team: "team-a" });
    expect(tableRows()).toEqual(["key-a", "model_usage.deletedKey(0123abcd)"]);
    // The keys' 90 of the Team's 150.
    expect(screen.getByTestId("usage-key-coverage-hint").textContent).toBe(
      "model_usage.tabs.apiKeyCoverageHint",
    );
  });
});
