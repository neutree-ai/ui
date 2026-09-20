import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

// The traces themselves are not under test: the list is empty, which keeps the
// table out of the picture, and the query never runs.
vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: () => ({
    data: { pages: [{ items: [], next_before: "" }], pageParams: [] },
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
});

describe("AITracesList API key filter", () => {
  it("names the unfiltered state instead of showing nothing", () => {
    render(<AITracesList />);

    expect(apiKeyTrigger().textContent).toBe("ai_traces.filters.allApiKeys");
  });

  it("shows the chosen key's name on one line, not its description", () => {
    render(<AITracesList />);

    selectKey("analytics-pipeline");

    const trigger = apiKeyTrigger();
    expect(trigger.textContent).toContain("analytics-pipeline");
    // The description belongs to the open list; in the closed control it used
    // to overflow the 32px trigger's own border.
    expect(trigger.textContent).not.toContain("TOS 使用");
    expect(within(trigger).queryByText("TOS 使用")).toBeNull();
  });

  it("still shows a key that has no description", () => {
    render(<AITracesList />);

    selectKey("plain-key");

    expect(apiKeyTrigger().textContent).toContain("plain-key");
  });
});
