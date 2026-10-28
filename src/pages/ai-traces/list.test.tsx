import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  type AITrace,
  type AITraceFilterOptions,
  AITraceRequestError,
  fetchAITraceFilterOptions,
} from "@/foundation/lib/api/ai-traces";
import { AITracesList } from "@/pages/ai-traces/list";

const context = vi.hoisted(() => ({
  params: { workspace: "design-lab" } as Record<string, string>,
  query: vi.fn(),
  optionsQuery: vi.fn(),
}));

vi.mock("@/foundation/lib/api/ai-traces", async () => ({
  ...(await vi.importActual<typeof import("@/foundation/lib/api/ai-traces")>(
    "@/foundation/lib/api/ai-traces",
  )),
  fetchAITraceFilterOptions: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useParsed: () => ({ params: context.params }),
  useList: ({ resource }: { resource: string }) => ({
    data: { data: resources[resource] ?? [] },
  }),
}));

// The query never runs; the pages come from `listState.items`, which is empty
// unless a test needs a row, and `listState.error` stands in for a failed request.
// The filter-options query likewise returns `listState.options`.
const listState = vi.hoisted(() => ({
  items: [] as unknown[],
  error: null as Error | null,
  options: undefined as AITraceFilterOptions | undefined,
  optionsError: null as Error | null,
}));

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: (options: unknown) => {
    context.query(options);
    return {
      data: {
        pages: [{ items: listState.items, next_before: "" }],
        pageParams: [],
      },
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      error: listState.error,
      refetch: vi.fn(),
    };
  },
  useQuery: (options: unknown) => {
    context.optionsQuery(options);
    return { data: listState.options, error: listState.optionsError };
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/foundation/components/ListPage", () => ({
  ListPage: ({
    children,
    extra,
  }: {
    children: ReactNode;
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

const exportButton = vi.hoisted(() => ({ props: vi.fn() }));
vi.mock("@/pages/ai-traces/components/TraceExportButton", () => ({
  TraceExportButton: (props: unknown) => {
    exportButton.props(props);
    return <button type="button">export</button>;
  },
}));

const apiKeys = [
  {
    id: "key-analytics",
    metadata: { name: "analytics-pipeline" },
    spec: { description: "TOS 使用" },
  },
  { id: "key-plain", metadata: { name: "plain-key" } },
];

const resources: Record<string, unknown[]> = {
  api_keys: apiKeys,
};

const filterOptions = (): AITraceFilterOptions => ({
  endpoints: [
    { name: "cloud-gateway", type: "external-endpoint" },
    { name: "qwen3-chat", type: "endpoint" },
    { name: "qwen3-chat", type: "external-endpoint" },
  ],
  endpoints_truncated: false,
  models: ["gpt-5", "qwen3"],
  models_truncated: false,
});

const optionsOf = (testId: string) => {
  fireEvent.click(screen.getByTestId(testId));
  return screen.getAllByRole("option").map((el) => el.textContent);
};

type OptionsQuery = {
  queryKey: [string, Record<string, unknown>];
  queryFn: (ctx: { signal?: AbortSignal }) => unknown;
};
const lastOptionsQuery = () =>
  context.optionsQuery.mock.lastCall?.[0] as OptionsQuery;

const lastQueryArgs = () => {
  const [, args] = context.query.mock.lastCall?.[0].queryKey ?? [];
  return args as Record<string, unknown>;
};

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
  listState.error = null;
  listState.options = filterOptions();
  listState.optionsError = null;
  context.params = { workspace: "design-lab" };
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
  it("shows only the chosen key's name in the closed filter, not its description", () => {
    renderList();
    expect(apiKeyTrigger().textContent).toBe("ai_traces.filters.allApiKeys");

    selectKey("analytics-pipeline");

    const trigger = apiKeyTrigger();
    expect(trigger.textContent).toContain("analytics-pipeline");
    expect(trigger.textContent).not.toContain("TOS 使用");
  });
});

describe("AITracesList endpoint and model filters", () => {
  it("suggests the endpoints the filter-options API returns, with their type", () => {
    renderList();

    expect(optionsOf("endpoint-filter")).toEqual([
      "ai_traces.filters.allEndpoints",
      "cloud-gatewayexternal-endpoint",
      "qwen3-chatendpoint",
      "qwen3-chatexternal-endpoint",
    ]);
  });

  it("suggests the models the filter-options API returns", () => {
    renderList();

    expect(optionsOf("model-filter")).toEqual([
      "ai_traces.filters.allModels",
      "gpt-5",
      "qwen3",
    ]);
  });

  it("asks for the options of the list's workspace, window and type", () => {
    renderList();

    const [, initial] = lastOptionsQuery().queryKey;
    const list = lastQueryArgs();
    expect(initial).toEqual({
      workspace: "design-lab",
      start: list.start,
      end: list.end,
      endpoint_type: undefined,
    });

    const typeTrigger = screen
      .getAllByRole("combobox")
      .find((node) => node.textContent === "ai_traces.filters.allTypes");
    if (!typeTrigger) throw new Error("endpoint type filter not found");
    fireEvent.click(typeTrigger);
    fireEvent.click(screen.getByRole("option", { name: "external-endpoint" }));

    const query = lastOptionsQuery();
    expect(query.queryKey[1]).toMatchObject({
      endpoint_type: "external-endpoint",
    });
    query.queryFn({});
    expect(fetchAITraceFilterOptions).toHaveBeenLastCalledWith(
      query.queryKey[1],
      undefined,
    );
  });

  it("filters by name only when an endpoint of a shared name is picked", () => {
    renderList();

    fireEvent.click(screen.getByTestId("endpoint-filter"));
    fireEvent.click(
      screen.getByRole("option", { name: "qwen3-chatexternal-endpoint" }),
    );

    expect(lastQueryArgs()).toMatchObject({ endpoint_name: "qwen3-chat" });
    expect(lastQueryArgs().endpoint_type).toBeUndefined();
  });

  it("queries by the full name of the picked endpoint and model", () => {
    renderList();

    fireEvent.click(screen.getByTestId("endpoint-filter"));
    fireEvent.click(
      screen.getByRole("option", { name: "cloud-gatewayexternal-endpoint" }),
    );
    fireEvent.click(screen.getByTestId("model-filter"));
    fireEvent.click(screen.getByRole("option", { name: "gpt-5" }));

    expect(lastQueryArgs()).toMatchObject({
      endpoint_name: "cloud-gateway",
      model: "gpt-5",
    });
  });

  it("leaves both filters out of the query until one is picked", () => {
    renderList();

    expect(lastQueryArgs().endpoint_name).toBeUndefined();
    expect(lastQueryArgs().model).toBeUndefined();
  });

  it("says when a list of names is incomplete", () => {
    listState.options = { ...filterOptions(), models_truncated: true };
    renderList();

    fireEvent.click(screen.getByTestId("endpoint-filter"));
    expect(screen.queryByText("ai_traces.filters.optionsTruncated")).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    fireEvent.click(screen.getByTestId("model-filter"));
    screen.getByText("ai_traces.filters.optionsTruncated");
  });

  it("still filters by a typed name when the options request fails", () => {
    listState.options = undefined;
    listState.optionsError = new AITraceRequestError(500, "boom");
    renderList();

    expect(screen.queryByText(/boom/)).toBeNull();
    fireEvent.click(screen.getByTestId("endpoint-filter"));
    fireEvent.change(
      screen.getByPlaceholderText("ai_traces.filters.endpointSearch"),
      { target: { value: "removed-endpoint" } },
    );
    fireEvent.click(screen.getByRole("option", { name: "removed-endpoint" }));

    expect(lastQueryArgs()).toMatchObject({
      endpoint_name: "removed-endpoint",
    });
  });
});

describe("AITracesList readings column", () => {
  it("renders the throughput without repeating the column's unit", () => {
    listState.items = [trace()];

    renderList();

    screen.getByText("155.2");
    expect(screen.queryByText(/tok\/s/)).toBeNull();
  });
});

describe("AITracesList without trace permission", () => {
  it("explains the missing permission instead of an empty, erroring page", () => {
    listState.error = new AITraceRequestError(403, "insufficient permissions");

    renderList();

    screen.getByText("ai_traces.forbidden");
    expect(screen.queryByText(/insufficient permissions/)).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });

  it("still shows other failures above the list", () => {
    listState.error = new AITraceRequestError(
      500,
      "ai-traces request failed: 500",
    );

    renderList();

    screen.getByText("ai-traces request failed: 500");
    screen.getByRole("table");
  });
});

// The params the export button was last rendered with.
const exportParams = () => {
  const call = exportButton.props.mock.lastCall;
  if (!call) throw new Error("export button not rendered");
  return (call[0] as { params: Record<string, unknown> }).params;
};

describe("AITracesList export", () => {
  it("exports with the list query's scope, window and filters", () => {
    context.params = { workspace: "_all_", api_key_id: "key-analytics" };

    renderList();

    const params = exportParams();
    const { limit, ...listFilters } = lastQueryArgs();
    expect(limit).toBe(50);
    expect(params).toEqual(listFilters);
    expect(params.workspace).toBe("_all_");
    expect(params.api_key_id).toBe("key-analytics");
    expect(params.start).toBeTruthy();
    expect(params.end).toBeTruthy();
  });

  it("follows a filter change", () => {
    renderList();

    selectKey("plain-key");

    const params = exportParams();
    expect(params.api_key_id).toBe("key-plain");
  });

  it("is not offered without trace permission", () => {
    listState.error = new AITraceRequestError(403, "insufficient permissions");

    renderList();

    expect(screen.queryByText("export")).toBeNull();
  });
});
