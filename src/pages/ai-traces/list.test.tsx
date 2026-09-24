import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AITrace } from "@/foundation/lib/api/ai-traces";
import { AITracesList } from "@/pages/ai-traces/list";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@refinedev/core", () => ({
  useParsed: () => ({ params: { workspace: "design-lab" } }),
  useList: () => ({ data: { data: apiKeys } }),
}));

// The query never runs; the pages come from `listState.items`, which is empty
// unless a test needs a row.
const listState = vi.hoisted(() => ({ items: [] as unknown[] }));

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: () => ({
    data: {
      pages: [{ items: listState.items, next_before: "" }],
      pageParams: [],
    },
    isLoading: false,
    isFetching: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    error: null,
    refetch: vi.fn(),
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/foundation/components/ListPage", () => ({
  ListPage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/foundation/components/DateRangePicker", async () => {
  const actual = await vi.importActual<
    typeof import("@/foundation/components/DateRangePicker")
  >("@/foundation/components/DateRangePicker");
  return {
    ...actual,
    DateRangePicker: () => <button type="button">range</button>,
  };
});

vi.mock("@/pages/ai-traces/components/StatusCodeFilter", () => ({
  StatusCodeFilter: () => null,
}));
vi.mock("@/pages/ai-traces/components/TraceStatsChart", () => ({
  TraceStatsChart: () => null,
}));
vi.mock("@/pages/ai-traces/components/TraceDetailDrawer", () => ({
  TraceDetailDrawer: () => null,
}));

const apiKeys = [
  {
    id: "key-analytics",
    metadata: { name: "analytics-pipeline" },
    spec: { description: "TOS 使用" },
  },
  { id: "key-plain", metadata: { name: "plain-key" } },
];

const apiKeyTrigger = () => {
  const trigger = screen
    .getAllByRole("combobox")
    .find((node) =>
      /allApiKeys|analytics-pipeline|plain-key/.test(node.textContent ?? ""),
    );
  if (!trigger) throw new Error("API key filter trigger not found");
  return trigger;
};

function selectKey(name: string) {
  fireEvent.click(apiKeyTrigger());
  fireEvent.click(screen.getByRole("option", { name: new RegExp(name) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  listState.items = [];
});

const trace = (overrides: Partial<AITrace> = {}): AITrace => ({
  request_id: "req_1",
  time: "2026-09-24T10:15:00.000Z",
  workspace: "design-lab",
  endpoint_type: "internal",
  endpoint_name: "llama3-chat-prod",
  response_status: 200,
  prompt_tokens: 800,
  completion_tokens: 1552,
  total_tokens: 2352,
  finish_reason: "stop",
  duration_ms: 10_000,
  user_agent: "mock-client/1.0",
  ...overrides,
});

// Rows carry tooltips (the API key cell), so the provider the real page mounts
// is part of the setup.
const renderList = () =>
  render(
    <TooltipProvider>
      <AITracesList />
    </TooltipProvider>,
  );

describe("AITracesList API key filter", () => {
  it("names the unfiltered state instead of showing nothing", () => {
    renderList();

    expect(apiKeyTrigger().textContent).toBe("ai_traces.filters.allApiKeys");
  });

  it("shows the chosen key's name on one line, not its description", () => {
    renderList();

    selectKey("analytics-pipeline");

    const trigger = apiKeyTrigger();
    expect(trigger.textContent).toContain("analytics-pipeline");
    // The description belongs to the open list; in the closed control it used
    // to overflow the 32px trigger's own border.
    expect(trigger.textContent).not.toContain("TOS 使用");
    expect(within(trigger).queryByText("TOS 使用")).toBeNull();
  });

  it("still shows a key that has no description", () => {
    renderList();

    selectKey("plain-key");

    expect(apiKeyTrigger().textContent).toContain("plain-key");
  });
});

describe("AITracesList readings column", () => {
  it("renders the throughput without repeating the column's unit", () => {
    // "155.2 tok/s" is eleven monospace characters, one too many for the 90px
    // column: the unit lives in the header, so the larger readings stopped
    // breaking onto a second line and lifting their row out of the grid.
    listState.items = [trace()];

    renderList();

    const cell = screen.getByText("155.2");
    expect(cell.tagName).toBe("TD");
    expect(cell.className).toContain("whitespace-nowrap");
    expect(screen.queryByText(/tok\/s/)).toBeNull();
  });

  it("guards the token and duration readings the same way", () => {
    listState.items = [trace()];

    renderList();

    for (const reading of ["2.35K", "10.00 s"]) {
      expect(screen.getByText(reading).className).toContain(
        "whitespace-nowrap",
      );
    }
  });
});
