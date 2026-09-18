import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiUsageRecord } from "@/domains/api-key/types";
import { ModelUsageList } from "@/pages/model-usage/list";

// The page's tables page through long key lists and re-scope to a single day
// when a day is picked. Both are page-level wiring, so they are asserted here
// with the chart library stubbed out (jsdom cannot measure a recharts chart).
const translations: Record<string, string> = {
  "model_usage.byApiKey": "By API key",
  "model_usage.byApiKeyOnDay": "By API key · {{date}}",
  "model_usage.byModel": "By model",
  "model_usage.byModelOnDay": "By model · {{date}}",
  "model_usage.daily.titleByKey": "Daily tokens by API key",
  "model_usage.daily.titleDayByKey": "Tokens by API key · single day",
  "model_usage.daily.backToPreset": "Back to last {{days}} days",
  "model_usage.daily.backToRange": "Back to {{range}}",
  "model_usage.daily.clickHint": "Click a day to scope the page to that day",
  "table.pagination.totalItems": "Total: {{total}} items",
  "table.pagination.page": "Page {{current}} of {{total}}",
  "table.pagination.goToNextPage": "Go to next page",
  "table.pagination.goToPreviousPage": "Go to previous page",
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

vi.mock("recharts", () => {
  const passthrough = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Bar: passthrough,
    BarChart: passthrough,
    CartesianGrid: passthrough,
    Cell: passthrough,
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

const rows: ApiUsageRecord[] = DATES.flatMap((date) =>
  Array.from({ length: KEY_COUNT }, (_, i) => {
    const rank = i + 1;
    return {
      date,
      api_key_id: `key-${rank}`,
      api_key_name: `key-${rank}`,
      api_key_display_name: `Key ${rank}`,
      api_key_description: `${rank}th busiest key`,
      endpoint_type: "endpoint",
      endpoint_name: "llama3-chat-prod",
      model_name: "deepseek-v3",
      workspace: "design-lab",
      usage: (KEY_COUNT - i) * 100,
      prompt_tokens: (KEY_COUNT - i) * 80,
      completion_tokens: (KEY_COUNT - i) * 20,
    };
  }),
);

vi.mock("@/domains/api-key/hooks/use-workspace-usage", () => ({
  useWorkspaceUsage: () => ({
    usageData: rows,
    isLoading: false,
    error: null,
    refetch: () => {},
  }),
}));

const cardFor = (title: string) => {
  const heading = screen.getByText(title);
  const card = heading.closest("div.border");
  if (!card) throw new Error(`no card for ${title}`);
  return within(card as HTMLElement);
};

beforeEach(() => {
  render(<ModelUsageList />);
});

describe("model usage tables", () => {
  it("pages a long key list instead of rendering every row", () => {
    const card = cardFor("By API key");
    const bodyRows = card
      .getAllByRole("row")
      .filter((row) => within(row).queryAllByRole("cell").length > 0);

    expect(bodyRows).toHaveLength(10);
    expect(bodyRows[0].textContent).toContain("Key 1");
    expect(card.getByText(`Total: ${KEY_COUNT} items`)).toBeDefined();
    expect(card.getByText("Page 1 of 3")).toBeDefined();
  });

  it("moves to the next page of keys", () => {
    const card = cardFor("By API key");

    fireEvent.click(card.getByRole("button", { name: "Go to next page" }));

    const bodyRows = card
      .getAllByRole("row")
      .filter((row) => within(row).queryAllByRole("cell").length > 0);
    expect(bodyRows[0].textContent).toContain("Key 11");
    expect(card.getByText("Page 2 of 3")).toBeDefined();
  });

  it("shows the per-record table 50 rows at a time", () => {
    const detail = cardFor("model_usage.detail.title");
    const bodyRows = detail
      .getAllByRole("row")
      .filter((row) => within(row).queryAllByRole("cell").length > 0);

    // 30 keys x 2 days = 60 records, so the first page holds 50 of them.
    expect(bodyRows).toHaveLength(50);
    expect(
      detail.getByText(`Total: ${KEY_COUNT * DATES.length} items`),
    ).toBeDefined();
    expect(detail.getByText("Page 1 of 2")).toBeDefined();
  });

  it("re-scopes titles to the day and offers the way back", () => {
    expect(screen.getByText("Daily tokens by API key")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "day" }));

    expect(screen.getByText("Tokens by API key · single day")).toBeDefined();
    expect(screen.getByText("By API key · 2026-09-01")).toBeDefined();
    expect(screen.getByText("By model · 2026-09-01")).toBeDefined();
    const back = screen.getByRole("button", { name: "Back to last 30 days" });

    fireEvent.click(back);

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
});
