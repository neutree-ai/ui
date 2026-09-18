import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DayTooltip,
  formatTick,
  shortLabel,
  TrendTooltip,
} from "@/pages/model-usage/components/UsageChart";
import type { UsageSeries } from "@/pages/model-usage/lib/usage-series";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const series = (
  key: string,
  name: string,
  description: string | null = null,
): UsageSeries => ({
  key,
  name,
  description,
  prompt: 0,
  completion: 0,
  total: 0,
});

const meta = new Map([
  ["key-1", series("key-1", "Key one", "owned by ops")],
  ["key-2", series("key-2", "Key two")],
  ["__other", series("__other", "Other 7 API keys")],
]);

describe("formatTick", () => {
  it("formats a date as M/D and leaves other labels alone", () => {
    expect(formatTick("2026-09-07")).toBe("9/7");
    expect(formatTick("Other 7 (total)")).toBe("Other 7 (total)");
  });
});

describe("shortLabel", () => {
  it("shortens a long axis label but leaves a short one alone", () => {
    expect(shortLabel("3402")).toBe("3402");
    expect(shortLabel("svc-reporting-pipeline-prod")).toBe("svc-repo…");
  });
});

describe("TrendTooltip", () => {
  it("renders nothing without an active payload", () => {
    const { container } = render(
      <TrendTooltip meta={meta} active={false} payload={[]} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when every series is zero", () => {
    const { container } = render(
      <TrendTooltip
        meta={meta}
        active
        label="2026-09-07"
        payload={[
          { dataKey: "key-1", value: 0, color: "blue" },
          { dataKey: "key-2", value: 0, color: "green" },
        ]}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("orders contributors by size, keeps 'other' last, and totals them", () => {
    render(
      <TrendTooltip
        meta={meta}
        active
        label="2026-09-07"
        payload={[
          { dataKey: "__other", value: 5, color: "grey" },
          { dataKey: "key-2", value: 30, color: "green" },
          { dataKey: "key-1", value: 60, color: "blue" },
          // A series recharts reports with no dataKey at all, and one that is
          // not in the metadata map: both have to render as their raw key.
          { color: "red" },
          { dataKey: "key-unknown", value: 2, color: "red" },
        ]}
      />,
    );

    const rows = screen.getAllByText(
      /Key one|Key two|Other 7 API keys|key-unknown/,
    );
    // Contributors by size, then "other" pinned last even though its total is
    // larger than the smallest contributor's.
    expect(rows.map((row) => row.textContent)).toEqual([
      "Key one · owned by ops",
      "Key two",
      "key-unknown",
      "Other 7 API keys",
    ]);
    // The footer total covers every listed row: 60 + 30 + 5 + 2 (the entry with
    // no value contributes nothing).
    expect(screen.getByText("model_usage.daily.tooltip.total")).toBeDefined();
    expect(screen.getByText("97")).toBeDefined();
  });
});

describe("DayTooltip", () => {
  it("renders nothing when no category is hovered", () => {
    const { container } = render(<DayTooltip active payload={[]} />);
    expect(container.innerHTML).toBe("");

    const inactive = render(<DayTooltip active={false} />);
    expect(inactive.container.innerHTML).toBe("");
  });

  it("names the category and splits prompt from completion", () => {
    render(
      <DayTooltip
        active
        payload={[
          {
            payload: {
              ...series("key-1", "Key one", "owned by ops"),
              label: "Key one",
              promptColor: "blue",
              completionColor: "lightblue",
              prompt: 80,
              completion: 20,
              total: 100,
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("Key one · owned by ops")).toBeDefined();
    expect(screen.getByText("model_usage.promptTokens")).toBeDefined();
    expect(screen.getByText("80")).toBeDefined();
    expect(screen.getByText("model_usage.completionTokens")).toBeDefined();
    expect(screen.getByText("20")).toBeDefined();
    expect(screen.getByText("100")).toBeDefined();
  });

  it("falls back to the name when the key has no description", () => {
    render(
      <DayTooltip
        active
        payload={[
          {
            payload: {
              ...series("key-2", "Key two"),
              label: "Key two",
              promptColor: "green",
              completionColor: "lightgreen",
            },
          },
        ]}
      />,
    );

    const title = screen.getByText("Key two");
    expect(within(title).queryByText("·")).toBeNull();
  });
});
