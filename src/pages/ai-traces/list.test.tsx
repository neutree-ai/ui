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

const context = vi.hoisted(() => ({
  params: { workspace: "design-lab" } as Record<string, string>,
  query: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useParsed: () => ({ params: context.params }),
  useList: () => ({ data: { data: apiKeys } }),
}));

// The traces themselves are not under test: the list is empty, which keeps the
// table out of the picture, and the query never runs.
vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: (options: unknown) => {
    context.query(options);
    return {
      data: { pages: [{ items: [], next_before: "" }], pageParams: [] },
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      error: null,
      refetch: vi.fn(),
    };
  },
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
  TraceStatsChart: () => <div>workspace-chart</div>,
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
  context.params = { workspace: "design-lab" };
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

describe("routing log links", () => {
  it("keeps exact times and target filters from the dashboard, without a workspace-wide chart", () => {
    context.params = {
      workspace: "design-lab",
      endpoint_name: "router",
      endpoint_type: "external-endpoint",
      request_model: "model/with & spaces",
      upstream: "provider",
      upstream_model: "m",
      request_mode: "non_stream",
      from: "1789882200123",
      to: "1789885800456",
    };
    render(<AITracesList />);
    const { queryKey } =
      context.query.mock.calls[context.query.mock.calls.length - 1][0];
    expect(queryKey[1]).toMatchObject({
      endpoint_name: "router",
      request_model: "model/with & spaces",
      upstream: "provider",
      upstream_model: "m",
      request_mode: "non_stream",
      start: new Date(1789882200123).toISOString(),
      end: new Date(1789885800456).toISOString(),
    });
    expect(screen.queryByText("workspace-chart")).toBeNull();
    expect(
      screen.getByLabelText("ai_traces.routing.requestModel"),
    ).toHaveProperty("value", "model/with & spaces");
  });
  it("falls back to a valid calendar range for malformed dashboard times", () => {
    context.params = {
      workspace: "design-lab",
      from: "99999999999999999999",
      to: "NaN",
    };
    render(<AITracesList />);
    const { queryKey } =
      context.query.mock.calls[context.query.mock.calls.length - 1][0];
    expect(Number.isFinite(Date.parse(queryKey[1].start))).toBe(true);
    expect(screen.getByText("workspace-chart")).toBeTruthy();
  });
});

describe("request ID search", () => {
  it("trims the exact ID, preserves the scope and time window, and can be cleared", () => {
    render(<AITracesList />);
    const original = context.query.mock.lastCall?.[0].queryKey[1];
    const input = screen.getByLabelText("ai_traces.filters.requestId");
    fireEvent.change(input, { target: { value: " req/with & spaces " } });
    expect(context.query.mock.lastCall?.[0].queryKey[1]).toMatchObject({
      workspace: "design-lab",
      request_id: "req/with & spaces",
      start: original.start,
      end: original.end,
    });
    expect(screen.queryByText("workspace-chart")).toBeNull();
    fireEvent.change(input, { target: { value: "" } });
    expect(
      context.query.mock.lastCall?.[0].queryKey[1].request_id,
    ).toBeUndefined();
    expect(screen.getByText("workspace-chart")).toBeTruthy();
  });
  it("initializes the ID from a link", () => {
    context.params.request_id = "request-from-link";
    render(<AITracesList />);
    expect(screen.getByLabelText("ai_traces.filters.requestId")).toHaveProperty(
      "value",
      "request-from-link",
    );
    expect(context.query.mock.lastCall?.[0].queryKey[1].request_id).toBe(
      "request-from-link",
    );
  });
});
