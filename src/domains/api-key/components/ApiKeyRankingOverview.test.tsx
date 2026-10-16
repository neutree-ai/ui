import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiKeyRankingOverview } from "./ApiKeyRankingOverview";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The donut is decoration here and recharts needs a ResizeObserver jsdom does
// not have; the ranking list under test renders without it.
vi.mock("recharts", async () => {
  const passthrough = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Cell: passthrough,
    Pie: passthrough,
    PieChart: passthrough,
    ResponsiveContainer: passthrough,
  };
});

// jsdom lays nothing out, so the real measurement always reports "fits". The
// flag stands in for the clipped state a long description produces in a
// browser — which is also the state the keyboard-reachability check needs.
const truncation = vi.hoisted(() => ({ value: false }));

vi.mock("@/foundation/hooks/use-is-truncated", () => ({
  useIsTruncated: () => truncation.value,
}));

const KEY_ID = "apikey-1";
const KEY_NAME = "api-key-001";
const LONG_DESCRIPTION = `跨语言布局验证 English layout description with a long unbroken value ${"L".repeat(80)}`;

const renderOverview = () =>
  render(
    <TooltipProvider delayDuration={0}>
      <ApiKeyRankingOverview
        keys={[{ id: KEY_ID, name: KEY_NAME, description: LONG_DESCRIPTION }]}
        traffic={
          new Map([
            [
              KEY_ID,
              {
                requests: 42,
                tokens: 1024,
                success: 42,
                avgDurationMs: 12,
                successRate: 1,
              },
            ],
          ])
        }
      />
    </TooltipProvider>,
  );

// Both panels (requests, tokens) carry the same key, so take the first line.
const rankingLabel = () => screen.getAllByTestId("api-key-ranking-entry")[0];

describe("ApiKeyRankingOverview", () => {
  beforeEach(() => {
    truncation.value = false;
  });

  it("uses an explicit empty state without a bare dash", () => {
    render(
      <ApiKeyRankingOverview
        keys={[{ id: "key-without-traffic", name: "Idle key" }]}
        traffic={new Map()}
      />,
    );

    expect(screen.getAllByText("api_keys.ranking.empty")).toHaveLength(2);
    expect(screen.queryByText("—")).toBeNull();
    expect(screen.queryByText("-")).toBeNull();
  });

  it("renders a long key description on the ranking line", () => {
    renderOverview();

    const label = rankingLabel();
    expect(label.textContent).toContain(KEY_NAME);
    expect(label.textContent).toContain(LONG_DESCRIPTION);
  });

  it("leaves a line that fits without a tooltip or a tab stop", () => {
    renderOverview();

    const label = rankingLabel();
    expect(label.getAttribute("tabindex")).toBeNull();
    // The tooltip belongs to the clipped state only; on a line that already
    // shows its whole value it would just repeat what the reader is looking at.
    fireEvent.focus(label);
    expect(screen.queryByRole("tooltip")).toBeNull();
    // This is a value, not a help topic, so the cursor stays a cursor.
    expect(label.className).not.toContain("cursor-help");
  });

  it("keeps a clipped line reachable by keyboard, with the full text in the tooltip", async () => {
    truncation.value = true;

    renderOverview();

    const label = rankingLabel();
    expect(label.getAttribute("tabindex")).toBe("0");

    fireEvent.focus(label);

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain(KEY_NAME);
    expect(tooltip.textContent).toContain(LONG_DESCRIPTION);
  });
});
