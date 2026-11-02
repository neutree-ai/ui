import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import { ApiKeyRankingOverview } from "./ApiKeyRankingOverview";

const KEY_NAME = "api-key-001";
const DESCRIPTION = "a long description that does not fit on the ranking line";

const renderOverview = () =>
  render(
    <TooltipProvider delayDuration={0}>
      <ApiKeyRankingOverview
        keys={[{ id: "key-1", name: KEY_NAME, description: DESCRIPTION }]}
        traffic={
          new Map([
            [
              "key-1",
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
const rankingLine = () => screen.getAllByTestId("api-key-ranking-entry")[0];

describe("ApiKeyRankingOverview", () => {
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

  it("leaves a line that fits without a tooltip or a tab stop", () => {
    renderOverview();

    fireEvent.focus(rankingLine());

    expect(rankingLine().getAttribute("tabindex")).toBeNull();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows the full text of a clipped line on keyboard focus", async () => {
    vi.mocked(useIsTruncated).mockReturnValue(true);
    renderOverview();

    expect(rankingLine().getAttribute("tabindex")).toBe("0");
    fireEvent.focus(rankingLine());

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain(KEY_NAME);
    expect(tooltip.textContent).toContain(DESCRIPTION);
  });
});
