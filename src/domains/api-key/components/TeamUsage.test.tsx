import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GroupUsageRecord } from "@/domains/api-key/types";

vi.mock("@/domains/api-key/hooks/use-group-usage", () => ({
  useGroupUsage: vi.fn(),
}));
vi.mock("@/foundation/components/ShowPage", () => ({
  ShowPage: {
    Section: ({ children }: { children: React.ReactNode }) => (
      <section>{children}</section>
    ),
    SummaryItem: () => null,
  },
}));

import { useGroupUsage } from "@/domains/api-key/hooks/use-group-usage";
import { TeamUsage } from "./TeamUsage";

const row = (
  kind: GroupUsageRecord["kind"],
  name: string,
  display_name: string,
): GroupUsageRecord => ({
  date: "2026-11-05",
  kind,
  name,
  display_name,
  workspace: "default",
  endpoint_type: null,
  endpoint_name: "ep",
  model_name: "m",
  requests: 1,
  usage: 10,
  prompt_tokens: null,
  completion_tokens: null,
});

describe("TeamUsage", () => {
  it("lists the members' personal usage apart from the applications", () => {
    vi.mocked(useGroupUsage).mockImplementation((_ws, _s, _e, kind) => ({
      usageData:
        kind === "User"
          ? [row("User", "u1", "Alice")]
          : kind === "ServiceAccount"
            ? [row("ServiceAccount", "sa1", "Bot")]
            : [],
      isLoading: false,
      isPlaceholder: false,
      error: null,
      refetch: async () => {},
    }));
    render(<TeamUsage teamName="ml" />);
    const members = screen.getByTestId("team-usage-by-member");
    within(members).getByText("Alice");
    within(screen.getByTestId("team-usage-by-application")).getByText("Bot");
    expect(within(members).queryByText("Bot")).toBeNull();
  });
});
