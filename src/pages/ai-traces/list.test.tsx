import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  type AITrace,
  AITraceRequestError,
} from "@/foundation/lib/api/ai-traces";
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
  useList: ({ resource }: { resource: string }) => ({
    data: { data: resources[resource] ?? [] },
  }),
}));

// cmdk observes and scrolls its list; jsdom implements neither.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = vi.fn();

// The query never runs; the pages come from `listState.items`, which is empty
// unless a test needs a row, and `listState.error` stands in for a failed request.
const listState = vi.hoisted(() => ({
  items: [] as unknown[],
  error: null as Error | null,
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

const resources: Record<string, unknown[]> = {
  api_keys: apiKeys,
  endpoints: [
    {
      metadata: { name: "qwen3-chat" },
      spec: { model: { name: "qwen3" } },
      status: { phase: "Running" },
    },
    {
      metadata: { name: "deepseek-ocr" },
      spec: { model: { name: "deepseek-ocr" } },
      status: { phase: "Paused" },
    },
  ],
  external_endpoints: [
    {
      metadata: { name: "cloud-gateway" },
      spec: {
        upstreams: [
          { model_mapping: { qwen3: "qwen3-max", "gpt-5": "gpt-5" } },
        ],
      },
      status: { phase: "Running" },
    },
  ],
};

const optionsOf = (testId: string) => {
  fireEvent.click(screen.getByTestId(testId));
  return screen.getAllByRole("option").map((el) => el.textContent);
};

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

describe("AITracesList endpoint and model filters", () => {
  it("suggests the workspace's endpoints of both kinds", () => {
    renderList();

    expect(optionsOf("endpoint-filter")).toEqual([
      "ai_traces.filters.allEndpoints",
      "cloud-gateway",
      "deepseek-ocr",
      "qwen3-chat",
    ]);
  });

  it("suggests each served model once", () => {
    renderList();

    expect(optionsOf("model-filter")).toEqual([
      "ai_traces.filters.allModels",
      "deepseek-ocr",
      "gpt-5",
      "qwen3",
    ]);
  });

  it("queries by the full name of the picked endpoint and model", () => {
    renderList();

    fireEvent.click(screen.getByTestId("endpoint-filter"));
    fireEvent.click(screen.getByRole("option", { name: "qwen3-chat" }));
    fireEvent.click(screen.getByTestId("model-filter"));
    fireEvent.click(screen.getByRole("option", { name: "gpt-5" }));

    expect(lastQueryArgs()).toMatchObject({
      endpoint_name: "qwen3-chat",
      model: "gpt-5",
    });
  });

  it("leaves both filters out of the query until one is picked", () => {
    renderList();

    expect(lastQueryArgs().endpoint_name).toBeUndefined();
    expect(lastQueryArgs().model).toBeUndefined();
  });
});

describe("AITracesList endpoint filter under a type filter", () => {
  it("lists an endpoint that exposes no model", () => {
    resources.external_endpoints.push({ metadata: { name: "bare-gateway" } });
    renderList();

    expect(optionsOf("endpoint-filter")).toContain("bare-gateway");
    resources.external_endpoints.pop();
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

describe("AITracesList without trace permission", () => {
  it("explains the missing permission instead of an empty, erroring page", () => {
    listState.error = new AITraceRequestError(403, "insufficient permissions");

    renderList();

    expect(screen.getByText("ai_traces.forbidden")).toBeTruthy();
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

    expect(screen.getByText("ai-traces request failed: 500")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
  });
});
