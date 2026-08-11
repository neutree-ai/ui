import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Timestamp from "./Timestamp";

const language = vi.hoisted(() => ({ current: "en-US" }));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    i18n: { resolvedLanguage: language.current },
  }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => (
    <span data-testid="absolute-time">{children}</span>
  ),
}));

describe("Timestamp rendering", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T12:00:00Z"));
    language.current = "en-US";
  });

  afterEach(() => vi.useRealTimers());

  it("renders an absolute timestamp by default", () => {
    render(<Timestamp timestamp="2026-08-10T12:00:00Z" />);

    expect(screen.getByText("2026-08-10 12:00")).toBeTruthy();
    expect(screen.queryByTestId("absolute-time")).toBeNull();
  });

  it("renders relative English time with an absolute tooltip", () => {
    render(<Timestamp timestamp="2026-08-10T12:00:00Z" relative />);

    const relativeTime = screen.getByText("a day ago");
    expect(relativeTime.className).toContain("border-dashed");
    expect(screen.getByTestId("absolute-time").textContent).toBe(
      "2026-08-10 12:00",
    );
  });

  it("uses the Chinese relative-time locale", () => {
    language.current = "zh-CN";
    render(<Timestamp timestamp="2026-08-10T12:00:00Z" relative />);

    expect(screen.getByText("1 天前")).toBeTruthy();
  });

  it("renders a placeholder for a missing timestamp", () => {
    render(<Timestamp timestamp={null} relative className="empty-time" />);

    const placeholder = screen.getByText("-");
    expect(placeholder.className).toContain("empty-time");
  });
});
