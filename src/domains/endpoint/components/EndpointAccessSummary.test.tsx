import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EndpointAccessSummary } from "./EndpointAccessSummary";

const copyMock = vi.fn();

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      key === "endpoints.access.summary" ? `${options?.count} URLs` : key,
  }),
}));

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

    expect(screen.getByText("2 URLs")).toBeTruthy();
    expect(screen.getByText("https://endpoint.example.com/v1")).toBeTruthy();
    expect(
      screen.getByText("https://endpoint.example.com/anthropic"),
    ).toBeTruthy();
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
