import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EndpointAccessSummary } from "./EndpointAccessSummary";

const copyMock = vi.fn();

vi.mock("@/foundation/hooks/use-copy-to-clipboard", () => ({
  useCopyToClipboard: () => ({ copy: copyMock, copied: false }),
}));

vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: { children: ReactNode }) => <>{children}</>,
  HoverCardTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  HoverCardContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("EndpointAccessSummary", () => {
  beforeEach(() => copyMock.mockClear());

  it("renders the summary and complete access URLs", () => {
    render(<EndpointAccessSummary serviceUrl="https://endpoint.example.com" />);

    screen.getByText("endpoints.access.summary:2");
    screen.getByText("https://endpoint.example.com/v1");
    screen.getByText("https://endpoint.example.com/anthropic");
  });

  it("copies each derived URL independently", () => {
    render(<EndpointAccessSummary serviceUrl="https://endpoint.example.com" />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "common.fields.anthropicUrl api_keys.buttons.copy",
      }),
    );

    expect(copyMock).toHaveBeenCalledWith(
      "https://endpoint.example.com/anthropic",
      {
        successMessage: "components.apiKey.copySuccess",
        errorMessage: "components.apiKey.errors.copyFailed",
      },
    );
  });
});
