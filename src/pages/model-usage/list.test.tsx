import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiUsageRecord } from "@/domains/api-key/types";
import { ModelUsageList } from "@/pages/model-usage/list";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@refinedev/core", () => ({
  useParsed: () => ({ params: { workspace: "design-lab" } }),
}));

// The chart library measures itself, which jsdom cannot do; the assertion is
// about the filter row, and the chart's own behaviour is not under test here.
vi.mock("recharts", async () => {
  const passthrough = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Bar: passthrough,
    BarChart: passthrough,
    CartesianGrid: passthrough,
    Legend: passthrough,
    Line: passthrough,
    LineChart: passthrough,
    ResponsiveContainer: passthrough,
    Tooltip: passthrough,
    XAxis: passthrough,
    YAxis: passthrough,
  };
});

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

const rows: ApiUsageRecord[] = [
  {
    date: "2026-09-01",
    api_key_id: "key-analytics",
    api_key_name: "analytics-pipeline",
    api_key_description: "TOS 使用",
    endpoint_type: "internal",
    endpoint_name: "llama3-chat-prod",
    model_name: "meta-llama/Meta-Llama-3-8B-Instruct",
    workspace: "design-lab",
    usage: 1200,
    prompt_tokens: 800,
    completion_tokens: 400,
  },
  {
    date: "2026-09-01",
    api_key_id: "key-plain",
    api_key_name: "plain-key",
    endpoint_type: "internal",
    endpoint_name: "llama3-chat-prod",
    model_name: "meta-llama/Meta-Llama-3-8B-Instruct",
    workspace: "design-lab",
    usage: 600,
    prompt_tokens: 400,
    completion_tokens: 200,
  },
];

vi.mock("@/domains/api-key/hooks/use-workspace-usage", () => ({
  useWorkspaceUsage: () => ({
    usageData: rows,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

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

describe("ModelUsageList API key filter", () => {
  it("shows the placeholder until a key is chosen", () => {
    render(<ModelUsageList />);

    expect(apiKeyTrigger().textContent).toBe("model_usage.filters.allApiKeys");
  });

  it("shows the chosen key's name on one line, not its description", () => {
    render(<ModelUsageList />);

    selectKey("analytics-pipeline");

    const trigger = apiKeyTrigger();
    expect(trigger.textContent).toContain("analytics-pipeline");
    // The description belongs to the open list; in the closed control it used
    // to overflow the 32px trigger's own border.
    expect(trigger.textContent).not.toContain("TOS 使用");
    expect(within(trigger).queryByText("TOS 使用")).toBeNull();
  });

  it("still shows a key that has no description", () => {
    render(<ModelUsageList />);

    selectKey("plain-key");

    expect(apiKeyTrigger().textContent).toContain("plain-key");
  });
});
