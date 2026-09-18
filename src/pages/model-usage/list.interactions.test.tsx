import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiUsageRecord } from "@/domains/api-key/types";
import { ModelUsageList } from "@/pages/model-usage/list";

// Page-level wiring for the usage page: paging, the day scope, and the filter
// and chart controls. The chart library is stubbed with the smallest possible
// fakes that still call back into the handlers the page passes it, so the
// assertions are about our behaviour rather than about recharts.
const translations: Record<string, string> = {
  "model_usage.byApiKey": "By API key",
  "model_usage.byApiKeyOnDay": "By API key · {{date}}",
  "model_usage.byModel": "By model",
  "model_usage.byModelOnDay": "By model · {{date}}",
  "model_usage.daily.titleByKey": "Daily tokens by API key",
  "model_usage.daily.titleByModel": "Daily tokens by model",
  "model_usage.daily.titleDayByKey": "Tokens by API key · single day",
  "model_usage.daily.titleDayByModel": "Tokens by model · single day",
  "model_usage.daily.backToPreset": "Back to last {{days}} days",
  "model_usage.daily.backToRange": "Back to {{range}}",
  "model_usage.daily.clickHint": "Click a day to scope the page to that day",
  "model_usage.detail.title": "Daily detail",
  "model_usage.detail.external": "External",
  "model_usage.detail.internal": "Internal",
  "table.pagination.totalItems": "Total: {{total}} items",
  "table.pagination.page": "Page {{current}} of {{total}}",
  "table.pagination.goToNextPage": "Go to next page",
};

const translate = (key: string, options?: Record<string, unknown>) => {
  const template = translations[key] ?? key;
  if (!options) return template;
  return Object.entries(options).reduce(
    (acc, [name, value]) => acc.replace(`{{${name}}}`, String(value)),
    template,
  );
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate }),
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: translate }),
}));

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
  usageRow("2026-09-02", 3, {
    api_key_display_name: null,
    api_key_description: undefined,
    endpoint_name: "",
    model_name: null,
    usage: 9_999_997,
    prompt_tokens: 9_999_997,
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

const cardFor = (title: string) => {
  const heading = screen.getByText(title);
  const card = heading.closest("div.flex.h-full");
  if (!card) throw new Error(`no card for ${title}`);
  return within(card as HTMLElement);
};

const bodyRows = (scope: ReturnType<typeof within>) =>
  scope
    .getAllByRole("row")
    .filter(
      (row: HTMLElement) => within(row).queryAllByRole("cell").length > 0,
    );

// Radix needs a pointer-style open before its items exist in the DOM.
const openSelect = (index: number) =>
  fireEvent.pointerDown(screen.getAllByRole("combobox")[index], {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });

const pickOption = (label: string) => {
  const option = screen
    .getAllByRole("option")
    .find((node) => node.textContent?.includes(label));
  if (!option) throw new Error(`no option labelled ${label}`);
  fireEvent.click(option);
};

// jsdom has no pointer capture or scrollIntoView; Radix Select calls both while
// opening, and without them the option list never mounts.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  refetch.mockClear();
  hookState = { usageData: rows, isLoading: false, error: null };
  render(<ModelUsageList />);
});

describe("model usage tables", () => {
  it("pages a long key list instead of rendering every row", () => {
    const card = cardFor("By API key");

    expect(bodyRows(card)).toHaveLength(10);
    expect(bodyRows(card)[0].textContent).toContain("Key 1");
    expect(card.getByText(`Total: ${KEY_COUNT} items`)).toBeDefined();
    expect(card.getByText("Page 1 of 3")).toBeDefined();
  });

  it("moves to the next page of keys", () => {
    const card = cardFor("By API key");

    fireEvent.click(card.getByRole("button", { name: "Go to next page" }));

    expect(bodyRows(card)[0].textContent).toContain("Key 11");
    expect(card.getByText("Page 2 of 3")).toBeDefined();
  });

  it("shows the per-record table 50 rows at a time", () => {
    const detail = cardFor("Daily detail");

    expect(bodyRows(detail)).toHaveLength(50);
    expect(detail.getByText(`Total: ${rows.length} items`)).toBeDefined();
    expect(detail.getByText("Page 1 of 2")).toBeDefined();
  });

  it("renders the type badge for internal, external and unknown endpoints", () => {
    const detail = cardFor("Daily detail");

    expect(detail.getAllByText("Internal").length).toBeGreaterThan(0);
    expect(detail.getByText("External")).toBeDefined();
    expect(detail.getAllByText("-").length).toBeGreaterThan(0);
  });
});

describe("model usage scope", () => {
  it("re-scopes titles to the day and offers the way back", () => {
    expect(screen.getByText("Daily tokens by API key")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "day" }));

    expect(screen.getByText("Tokens by API key · single day")).toBeDefined();
    expect(screen.getByText("By API key · 2026-09-01")).toBeDefined();
    expect(screen.getByText("By model · 2026-09-01")).toBeDefined();

    fireEvent.click(
      screen.getByRole("button", { name: "Back to last 30 days" }),
    );

    expect(screen.getByText("Daily tokens by API key")).toBeDefined();
    expect(screen.getByText("By API key")).toBeDefined();
  });

  it("returns to the custom window the reader picked, not a preset", () => {
    fireEvent.click(screen.getByRole("button", { name: "custom range" }));
    fireEvent.click(screen.getByRole("button", { name: "day" }));

    fireEvent.click(
      screen.getByRole("button", { name: "Back to Jul 1 – Jul 10" }),
    );

    expect(screen.getByText("Daily tokens by API key")).toBeDefined();
    expect(screen.queryByText("Tokens by API key · single day")).toBeNull();
  });

  it("narrows the range to the day picked in the chart", () => {
    fireEvent.click(screen.getByRole("button", { name: "pick-day" }));

    expect(screen.getByText("Tokens by API key · single day")).toBeDefined();
    expect(screen.getByText("By API key · 2026-09-01")).toBeDefined();
  });

  it("ignores a chart click that carries no category", () => {
    fireEvent.click(
      screen.getByRole("button", { name: "pick-day-without-label" }),
    );

    expect(screen.getByText("Daily tokens by API key")).toBeDefined();
    expect(screen.queryByText("Tokens by API key · single day")).toBeNull();
  });

  it("scopes to a single key's models when one is picked, and back again", () => {
    openSelect(0);
    pickOption("Key 11");

    expect(screen.getByText("Daily tokens by model")).toBeDefined();
    expect(screen.getByTestId("bar-chart")).toBeDefined();

    openSelect(0);
    pickOption("model_usage.filters.allApiKeys");

    expect(screen.getByText("Daily tokens by API key")).toBeDefined();
    expect(screen.getByTestId("line-chart")).toBeDefined();
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
    expect(screen.getByTestId("line-chart")).toBeDefined();

    fireEvent.click(
      screen.getByRole("button", { name: "model_usage.chart.bar" }),
    );
    expect(screen.getByTestId("bar-chart")).toBeDefined();

    fireEvent.click(
      screen.getByRole("button", { name: "model_usage.chart.line" }),
    );
    expect(screen.getByTestId("line-chart")).toBeDefined();
  });

  it("labels the legend with the series and toggles it", () => {
    const legend = screen.getByRole("button", { name: /Key 1/ });
    expect(legend.textContent).toContain("1th busiest key");

    // Hiding then showing the series again, plus an entry with no dataKey,
    // which the page has to ignore rather than hide the wrong thing.
    fireEvent.click(legend);
    fireEvent.click(legend);
    fireEvent.click(screen.getByRole("button", { name: "legend-without-key" }));
    expect(screen.getByRole("button", { name: /Key 1/ })).toBeDefined();
  });

  it("formats the axes with dates and compact token units", () => {
    expect(screen.getAllByTestId("axis-date")[0].textContent).toBe("9/1");
    expect(screen.getAllByTestId("axis-value")[0].textContent).toBe("1.23M");
  });

  it("filters by the model name typed into the filter", () => {
    fireEvent.change(screen.getByPlaceholderText("model_usage.filters.model"), {
      target: { value: "deepseek" },
    });

    expect(cardFor("By model").getByText("deepseek-v3")).toBeDefined();
  });

  it("filters by endpoint type", () => {
    openSelect(1);
    pickOption("External");

    const detail = cardFor("Daily detail");
    // One record survives the filter, so the detail table is a single row and
    // small enough that it renders no pager at all.
    const remaining = bodyRows(detail);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].textContent).toContain("External");
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

    expect(screen.getByText("Tokens by model · single day")).toBeDefined();
    expect(screen.getByText("By API key · 2026-09-01")).toBeDefined();
  });

  it("shows the loader until the first page of usage arrives", () => {
    renderWith({ usageData: [], isLoading: true });

    // The chart shows the loader; the tables below already know they are empty
    // because they read the same slice of data.
    expect(screen.getByTitle("Loading...")).toBeDefined();
  });

  it("shows the empty state when the window has no usage", () => {
    renderWith({ usageData: [] });

    // The chart and all three tables each say it in their own place.
    expect(screen.getAllByText("model_usage.empty").length).toBe(4);
  });

  it("surfaces a failed usage request above the tables", () => {
    renderWith({ usageData: [], error: new Error("usage rpc failed") });

    expect(screen.getByText("usage rpc failed")).toBeDefined();
  });
});
