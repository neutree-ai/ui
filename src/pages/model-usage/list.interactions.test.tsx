import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ApiUsageRecord,
  GroupUsageKind,
  GroupUsageRecord,
} from "@/domains/api-key/types";
import { openMenu } from "@/foundation/testing/interactions";
import { ModelUsageList } from "@/pages/model-usage/list";

// Page-level wiring for the usage page: paging, the day scope, and the filter
// and chart controls. The chart library is stubbed with the smallest possible
// fakes that still call back into the handlers the page passes it, so the
// assertions are about our behaviour rather than about recharts.
vi.mock("@refinedev/core", () => ({
  useParsed: () => ({ params: { workspace: "design-lab" } }),
}));

const chartProps = {
  day: "2026-09-01" as const,
};

vi.mock("recharts", () => {
  type ChartProps = {
    children?: ReactNode;
    onClick?: (state: { activeLabel?: string }) => void;
  };
  const named = (testId: string) => {
    const Chart = ({ children, onClick }: ChartProps) => (
      <div data-testid={testId}>
        {onClick ? (
          <>
            <button
              type="button"
              onClick={() => onClick({ activeLabel: chartProps.day })}
            >
              pick-day
            </button>
            {/* A hover/click the chart reports without a category: the page
                must ignore it rather than scope itself to "undefined". */}
            <button type="button" onClick={() => onClick({})}>
              pick-day-without-label
            </button>
          </>
        ) : null}
        {children}
      </div>
    );
    Chart.displayName = testId;
    return Chart;
  };
  // Axes and the legend call the callbacks the page hands them, which is what
  // exercises the tick formatting and the series toggle.
  // The X axis carries a date, the Y axis a token count; hand each the kind of
  // value the page's formatter expects.
  const Axis = ({
    tickFormatter,
    dataKey,
  }: {
    tickFormatter?: (value: never) => string;
    dataKey?: string;
  }) => (
    <div data-testid={`axis-${dataKey ?? "value"}`}>
      {tickFormatter
        ? (tickFormatter as (value: string | number) => string)(
            dataKey === "date" ? "2026-09-01" : 1_234_567,
          )
        : null}
    </div>
  );
  const Legend = ({
    formatter,
    onClick,
  }: {
    formatter?: (value: unknown, entry: { dataKey?: string }) => ReactNode;
    onClick?: (entry: { dataKey?: string }) => void;
  }) => (
    <>
      <button type="button" onClick={() => onClick?.({ dataKey: "key-1" })}>
        {formatter ? formatter(undefined, { dataKey: "key-1" }) : null}
      </button>
      {/* A legend entry without a dataKey: recharts hands one over for the
          "other" series' formatting pass and the page has to ignore it. */}
      <button type="button" onClick={() => onClick?.({})}>
        legend-without-key
      </button>
    </>
  );
  const passthrough = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Bar: passthrough,
    BarChart: named("bar-chart"),
    CartesianGrid: passthrough,
    Cell: passthrough,
    Legend,
    Line: passthrough,
    LineChart: named("line-chart"),
    ResponsiveContainer: passthrough,
    Tooltip: () => null,
    XAxis: Axis,
    YAxis: Axis,
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

// Stands in for the date control: one button picks a custom window, the other a
// single day — the same change clicking a day in the chart makes to the range.
vi.mock("@/foundation/components/DateRangePicker", async () => {
  const actual = await vi.importActual<
    typeof import("@/foundation/components/DateRangePicker")
  >("@/foundation/components/DateRangePicker");
  return {
    ...actual,
    DateRangePicker: ({
      onChange,
    }: {
      onChange: (range: { start: string; end: string }) => void;
    }) => (
      <>
        <button
          type="button"
          onClick={() => onChange({ start: "2026-07-01", end: "2026-07-10" })}
        >
          custom range
        </button>
        <button
          type="button"
          onClick={() => onChange({ start: "2026-09-01", end: "2026-09-01" })}
        >
          day
        </button>
      </>
    ),
  };
});

const KEY_COUNT = 30;
const DATES = ["2026-09-01", "2026-09-02"];

const usageRow = (
  date: string,
  rank: number,
  overrides: Partial<ApiUsageRecord> = {},
): ApiUsageRecord => ({
  date,
  api_key_id: `key-${rank}`,
  api_key_name: `key-${rank}`,
  api_key_display_name: `Key ${rank}`,
  api_key_description: `${rank}th busiest key`,
  endpoint_type: "endpoint",
  endpoint_name: "llama3-chat-prod",
  model_name: "deepseek-v3",
  workspace: "design-lab",
  usage: (KEY_COUNT - rank + 1) * 100,
  prompt_tokens: (KEY_COUNT - rank + 1) * 80,
  completion_tokens: (KEY_COUNT - rank + 1) * 20,
  ...overrides,
});

const rows: ApiUsageRecord[] = [
  ...DATES.flatMap((date) =>
    Array.from({ length: KEY_COUNT }, (_, i) => usageRow(date, i + 1)),
  ),
  // Two extra records so the detail table has to render the external badge and
  // the "no type" placeholder.
  usageRow("2026-09-02", 1, {
    endpoint_type: "external-endpoint",
    endpoint_name: "openai-proxy",
    usage: 9_999_999,
    prompt_tokens: 9_999_999,
    completion_tokens: 0,
  }),
  usageRow("2026-09-02", 2, {
    endpoint_type: null,
    usage: 9_999_998,
    prompt_tokens: 9_999_998,
    completion_tokens: 0,
  }),
  // The shape a historical or hand-made key can have: no display name, no
  // description, no model and no endpoint name, so the page has to fall back
  // in every one of those places.
  usageRow("2026-09-02", KEY_COUNT + 1, {
    api_key_id: "key-legacy",
    api_key_name: "legacy-key",
    api_key_display_name: null,
    api_key_description: undefined,
    endpoint_name: "",
    model_name: null,
    usage: 1,
    prompt_tokens: 1,
    completion_tokens: 0,
  }),
];

const refetch = vi.fn();

// The hook's answer for the current test; individual cases reassign it before
// rendering so the loading, empty and error branches are reachable.
let hookState: {
  usageData: ApiUsageRecord[];
  isLoading: boolean;
  error: Error | null;
} = { usageData: rows, isLoading: false, error: null };

vi.mock("@/domains/api-key/hooks/use-workspace-usage", () => ({
  useWorkspaceUsage: () => ({ ...hookState, refetch }),
}));

let canReadGroups = false;
let canReadSubtree = false;
let groupRows: GroupUsageRecord[] = [];
const groupKinds: Array<string | undefined> = [];

vi.mock("@/foundation/hooks/use-has-permission", () => ({
  useHasGlobalPermission: () => ({ allowed: canReadGroups, isLoading: false }),
  useHasPermission: () => ({ allowed: canReadSubtree, isLoading: false }),
}));

let orgUnits: Array<{
  id: number;
  path: string;
  metadata: { name: string; display_name?: string };
}> = [];
let teams: Array<{
  id: number;
  metadata: { name: string; display_name?: string };
}> = [];
vi.mock("@/domains/organization/hooks/use-organization", async () => {
  const { orgTreeIndex, teamIndex } = await import(
    "@/domains/organization/lib/org-tree"
  );
  return {
    useOrgTree: () => ({
      ...orgTreeIndex(orgUnits as never),
      isLoading: false,
      error: null,
    }),
    useTeamsByName: () => ({ ...teamIndex(teams as never), isLoading: false }),
  };
});

const groupFilters: Array<{ orgUnit?: string; team?: string } | undefined> = [];

vi.mock("@/domains/api-key/hooks/use-group-usage", () => ({
  useGroupUsage: (
    workspace: string | undefined,
    _start: string,
    _end: string,
    kind: GroupUsageKind,
    filter?: { orgUnit?: string; team?: string },
  ) => {
    groupKinds.push(workspace ? kind : undefined);
    groupFilters.push(filter);
    return {
      usageData: workspace ? groupRows.filter((r) => r.kind === kind) : [],
      isLoading: false,
      error: null,
      refetch,
    };
  },
}));

const cardFor = (title: string) =>
  within(screen.getByRole("region", { name: title }));

const bodyRows = (scope: ReturnType<typeof within>) =>
  scope
    .getAllByRole("row")
    .filter(
      (row: HTMLElement) => within(row).queryAllByRole("cell").length > 0,
    );

const openSelect = (index: number) =>
  openMenu(screen.getAllByRole("combobox")[index]);

const pickOption = (label: string) => {
  const option = screen
    .getAllByRole("option")
    .find((node) => node.textContent?.includes(label));
  if (!option) throw new Error(`no option labelled ${label}`);
  fireEvent.click(option);
};

beforeEach(() => {
  refetch.mockClear();
  canReadGroups = false;
  canReadSubtree = false;
  groupKinds.length = 0;
  groupFilters.length = 0;
  hookState = { usageData: rows, isLoading: false, error: null };
  render(<ModelUsageList />);
});

describe("model usage tables", () => {
  it("pages a long key list instead of rendering every row", () => {
    const card = cardFor("model_usage.byApiKey");

    expect(bodyRows(card)).toHaveLength(10);
    expect(bodyRows(card)[0].textContent).toContain("Key 1");
    card.getByText(`table.pagination.totalItems:${KEY_COUNT + 1}`);
    card.getByText("table.pagination.page:1,4");
  });

  it("moves to the next page of keys", () => {
    const card = cardFor("model_usage.byApiKey");

    fireEvent.click(
      card.getByRole("button", { name: "table.pagination.goToNextPage" }),
    );

    expect(bodyRows(card)[0].textContent).toContain("Key 11");
    card.getByText("table.pagination.page:2,4");
  });

  it("shows the per-record table 50 rows at a time", () => {
    const detail = cardFor("model_usage.detail.title");

    expect(bodyRows(detail)).toHaveLength(50);
    detail.getByText(`table.pagination.totalItems:${rows.length}`);
    detail.getByText("table.pagination.page:1,2");
  });

  it("renders the type badge for internal, external and unknown endpoints", () => {
    const detail = cardFor("model_usage.detail.title");

    expect(
      detail.getAllByText("model_usage.detail.internal").length,
    ).toBeGreaterThan(0);
    detail.getByText("model_usage.detail.external");
    expect(detail.getAllByText("-").length).toBeGreaterThan(0);
  });
});

describe("model usage scope", () => {
  it("re-scopes titles to the day and offers the way back", () => {
    screen.getByText("model_usage.daily.titleByKey");

    fireEvent.click(screen.getByRole("button", { name: "day" }));

    screen.getByText("model_usage.daily.titleDayByKey");
    screen.getByText("model_usage.byApiKeyOnDay:2026-09-01");
    screen.getByText("model_usage.byModelOnDay:2026-09-01");

    fireEvent.click(
      screen.getByRole("button", { name: "model_usage.daily.backToPreset:30" }),
    );

    screen.getByText("model_usage.daily.titleByKey");
    screen.getByText("model_usage.byApiKey");
  });

  it("returns to the custom window the reader picked, not a preset", () => {
    fireEvent.click(screen.getByRole("button", { name: "custom range" }));
    fireEvent.click(screen.getByRole("button", { name: "day" }));

    fireEvent.click(
      screen.getByRole("button", {
        name: "model_usage.daily.backToRange:Jul 1 – Jul 10",
      }),
    );

    screen.getByText("model_usage.daily.titleByKey");
    expect(screen.queryByText("model_usage.daily.titleDayByKey")).toBeNull();
  });

  it("narrows the range to the day picked in the chart", () => {
    fireEvent.click(screen.getByRole("button", { name: "pick-day" }));

    screen.getByText("model_usage.daily.titleDayByKey");
    screen.getByText("model_usage.byApiKeyOnDay:2026-09-01");
  });

  it("ignores a chart click that carries no category", () => {
    fireEvent.click(
      screen.getByRole("button", { name: "pick-day-without-label" }),
    );

    screen.getByText("model_usage.daily.titleByKey");
    expect(screen.queryByText("model_usage.daily.titleDayByKey")).toBeNull();
  });

  it("shows only the chosen key's name in the closed filter, not its description", () => {
    const trigger = screen.getAllByRole("combobox")[0];
    expect(trigger.textContent).toBe("model_usage.filters.allApiKeys");

    openSelect(0);
    pickOption("Key 12");

    expect(trigger.textContent).toContain("Key 12");
    expect(trigger.textContent).not.toContain("12th busiest key");
  });

  it("scopes to a single key's models when one is picked, and back again", () => {
    openSelect(0);
    pickOption("Key 11");

    screen.getByText("model_usage.daily.titleByModel");
    screen.getByTestId("bar-chart");

    openSelect(0);
    pickOption("model_usage.filters.allApiKeys");

    screen.getByText("model_usage.daily.titleByKey");
    screen.getByTestId("line-chart");
  });
});

describe("model usage chart controls", () => {
  it("refreshes on demand", () => {
    fireEvent.click(
      screen.getByRole("button", { name: "model_usage.refresh" }),
    );
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("switches between the line and stacked-bar trend views", () => {
    screen.getByTestId("line-chart");

    fireEvent.click(
      screen.getByRole("button", { name: "model_usage.chart.bar" }),
    );
    screen.getByTestId("bar-chart");

    fireEvent.click(
      screen.getByRole("button", { name: "model_usage.chart.line" }),
    );
    screen.getByTestId("line-chart");
  });

  it("labels the legend with the series and toggles it", () => {
    const legend = screen.getByRole("button", { name: /Key 1/ });
    expect(legend.textContent).toContain("1th busiest key");

    // Hiding then showing the series again, plus an entry with no dataKey,
    // which the page has to ignore rather than hide the wrong thing.
    fireEvent.click(legend);
    fireEvent.click(legend);
    fireEvent.click(screen.getByRole("button", { name: "legend-without-key" }));
    screen.getByRole("button", { name: /Key 1/ });
  });

  it("formats the axes with dates and compact token units", () => {
    expect(screen.getAllByTestId("axis-date")[0].textContent).toBe("9/1");
    expect(screen.getAllByTestId("axis-value")[0].textContent).toBe("1.23M");
  });

  it("filters by the model name typed into the filter", () => {
    fireEvent.change(screen.getByPlaceholderText("model_usage.filters.model"), {
      target: { value: "deepseek" },
    });

    cardFor("model_usage.byModel").getByText("deepseek-v3");
  });

  it("filters by endpoint type", () => {
    openSelect(1);
    pickOption("model_usage.detail.external");

    const detail = cardFor("model_usage.detail.title");
    // One record survives the filter, so the detail table is a single row and
    // small enough that it renders no pager at all.
    const remaining = bodyRows(detail);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].textContent).toContain("model_usage.detail.external");
    expect(remaining[0].textContent).toContain("openai-proxy");
  });
});

describe("model usage states", () => {
  const renderWith = (state: Partial<typeof hookState>) => {
    cleanup();
    hookState = { usageData: rows, isLoading: false, error: null, ...state };
    render(<ModelUsageList />);
  };

  it("titles a single day scoped to one key", () => {
    openSelect(0);
    pickOption("Key 11");
    fireEvent.click(screen.getByRole("button", { name: "pick-day" }));

    screen.getByText("model_usage.daily.titleDayByModel");
    screen.getByText("model_usage.byApiKeyOnDay:2026-09-01");
  });

  it("shows the loader until the first page of usage arrives", () => {
    renderWith({ usageData: [], isLoading: true });

    // The chart shows the loader; the tables below already know they are empty
    // because they read the same slice of data.
    screen.getByTitle("Loading...");
  });

  it("shows the empty state when the window has no usage", () => {
    renderWith({ usageData: [] });

    // The chart and all three tables each say it in their own place.
    expect(screen.getAllByText("model_usage.empty").length).toBe(4);
  });

  it("surfaces a failed usage request above the tables", () => {
    renderWith({ usageData: [], error: new Error("usage rpc failed") });

    screen.getByText("usage rpc failed");
  });
});

describe("usage by group", () => {
  const groupRow = (
    kind: GroupUsageKind,
    name: string,
    displayName: string | null,
    endpointType: string,
    requests: number,
    usage: number,
  ): GroupUsageRecord => ({
    date: "2026-09-01",
    kind,
    name,
    display_name: displayName,
    workspace: "design-lab",
    endpoint_type: endpointType,
    endpoint_name: "ep",
    model_name: "m",
    requests,
    usage,
    prompt_tokens: usage,
    completion_tokens: 0,
  });

  const renderAsReader = () => {
    cleanup();
    canReadGroups = true;
    groupRows = [
      groupRow("User", "u-1", "Alice", "endpoint", 2, 30),
      groupRow("User", "u-1", "Alice", "external-endpoint", 1, 5),
      groupRow("User", "u-2", "Bob", "endpoint", 1, 100),
      groupRow("OrgUnit", "dept-a", "Dept A", "endpoint", 3, 35),
    ];
    render(<ModelUsageList />);
  };

  it("is hidden without a global workspace:usage-read", () => {
    expect(screen.queryByText("model_usage.group.title")).toBeNull();
    expect(groupKinds.every((kind) => kind === undefined)).toBe(true);
  });

  const groupCard = () =>
    within(screen.getByRole("region", { name: /^model_usage\.group\.title/ }));

  it("sums requests and tokens per user", () => {
    renderAsReader();

    const card = groupCard();
    const [bob, alice] = bodyRows(card);
    expect(bob.textContent).toContain("Bob");
    expect(alice.textContent).toContain("Alice");
    expect(alice.textContent).toContain("3");
    card.getByText("model_usage.group.requests");
  });

  it("applies the type filter", () => {
    renderAsReader();

    openSelect(2);
    pickOption("model_usage.detail.external");

    const rowsShown = bodyRows(groupCard());
    expect(rowsShown).toHaveLength(1);
    expect(rowsShown[0].textContent).toContain("Alice");
  });

  it("switches to departments", () => {
    renderAsReader();

    openSelect(3);
    pickOption("model_usage.group.kinds.OrgUnit");

    expect(groupKinds.at(-1)).toBe("OrgUnit");
    const rowsShown = bodyRows(groupCard());
    expect(rowsShown).toHaveLength(1);
    expect(rowsShown[0].textContent).toContain("Dept A");
  });

  it("charts the kind picked for the group card", () => {
    renderAsReader();
    screen.getByText("model_usage.daily.titleByKey");

    openSelect(3);
    pickOption("model_usage.group.kinds.OrgUnit");

    screen.getByText(
      "model_usage.daily.titleByGroup:model_usage.group.kinds.OrgUnit",
    );
    expect(screen.getByTestId("usage-chart-dimension").textContent).toContain(
      "model_usage.group.kinds.OrgUnit",
    );
    // Departments overlap, so the chart shows no grand total.
    expect(screen.queryByText("model_usage.daily.totalLabel")).toBeNull();
  });

  it("shows a team by its display name, not its internal name", () => {
    cleanup();
    canReadGroups = true;
    groupRows = [
      groupRow("Team", "org-ldap-3f9a2c", "Platform", "endpoint", 1, 10),
    ];
    render(<ModelUsageList />);

    openSelect(3);
    pickOption("model_usage.group.kinds.Team");

    const [row] = bodyRows(groupCard());
    expect(row.textContent).toContain("Platform");
    expect(row.textContent).not.toContain("org-ldap-3f9a2c");
  });

  it("offers users and departments only to a subtree reader", () => {
    cleanup();
    canReadSubtree = true;
    groupRows = [groupRow("User", "u-1", "Alice", "endpoint", 2, 30)];
    render(<ModelUsageList />);

    const card = groupCard();
    expect(bodyRows(card)[0].textContent).toContain("Alice");
    screen.getByText(/model_usage\.group\.subtreeOnly/);

    openSelect(3);
    const options = screen
      .getAllByRole("option")
      .map((node) => node.textContent);
    expect(options).toEqual([
      "model_usage.group.kinds.User",
      "model_usage.group.kinds.OrgUnit",
    ]);
  });

  it("lists departments in tree order with their path", () => {
    orgUnits = [
      { id: 1, path: "1", metadata: { name: "org-1", display_name: "Corp" } },
      { id: 2, path: "1/2", metadata: { name: "org-2", display_name: "R&D" } },
      { id: 3, path: "1/3", metadata: { name: "org-3", display_name: "Ops" } },
    ];
    cleanup();
    canReadGroups = true;
    groupRows = [
      groupRow("OrgUnit", "org-2", "R&D", "endpoint", 1, 10),
      groupRow("OrgUnit", "org-1", "Corp", "endpoint", 3, 50),
      groupRow("OrgUnit", "org-3", "Ops", "endpoint", 2, 40),
      groupRow("OrgUnit", "org-gone", "Gone", "endpoint", 1, 90),
    ];
    render(<ModelUsageList />);

    openSelect(3);
    pickOption("model_usage.group.kinds.OrgUnit");

    const rowsShown = bodyRows(groupCard()).map(
      (row: HTMLElement) => row.textContent,
    );
    expect(rowsShown[0]).toContain("Corp");
    expect(rowsShown[1]).toContain("Corp / Ops");
    expect(rowsShown[2]).toContain("Corp / R&D");
    expect(rowsShown[3]).toContain("Gone");
    expect(rowsShown.join()).not.toContain("org-");
    orgUnits = [];
  });

  it("narrows users to a department subtree and a team", () => {
    orgUnits = [
      { id: 1, path: "1", metadata: { name: "org-1", display_name: "Corp" } },
      { id: 2, path: "1/2", metadata: { name: "rnd", display_name: "R&D" } },
    ];
    teams = [
      { id: 7, metadata: { name: "org-ldap-7", display_name: "Infra" } },
    ];
    renderAsReader();

    screen.getByTestId("usage-group-department");
    openSelect(4);
    pickOption("Corp / R&D");
    expect(groupFilters.at(-1)).toEqual({ orgUnit: "rnd", team: undefined });
    screen.getByText(/model_usage\.group\.filters\.subtreeIncluded/);

    openSelect(5);
    pickOption("Infra");
    expect(groupFilters.at(-1)).toEqual({ orgUnit: "rnd", team: "org-ldap-7" });

    // The rows the server returns are ranked by usage.
    const [bob, alice] = bodyRows(groupCard());
    expect(bob.textContent).toContain("Bob");
    expect(alice.textContent).toContain("Alice");

    // Other kinds are not filtered.
    openSelect(3);
    pickOption("model_usage.group.kinds.OrgUnit");
    expect(groupFilters.at(-1)).toEqual({});
    orgUnits = [];
    teams = [];
  });

  it("offers a subtree reader the department filter but no team filter", () => {
    orgUnits = [
      { id: 2, path: "1/2", metadata: { name: "rnd", display_name: "R&D" } },
    ];
    teams = [
      { id: 7, metadata: { name: "org-ldap-7", display_name: "Infra" } },
    ];
    cleanup();
    canReadSubtree = true;
    groupRows = [groupRow("User", "u-1", "Alice", "endpoint", 2, 30)];
    render(<ModelUsageList />);

    screen.getByTestId("usage-group-department");
    expect(screen.queryByTestId("usage-group-team")).toBeNull();
    openSelect(4);
    pickOption("R&D");
    expect(groupFilters.at(-1)).toEqual({ orgUnit: "rnd", team: undefined });
    orgUnits = [];
    teams = [];
  });
});
