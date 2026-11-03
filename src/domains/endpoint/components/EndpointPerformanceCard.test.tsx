import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EndpointPerformanceCard } from "./EndpointPerformanceCard";

const { useCustomMock } = vi.hoisted(() => ({
  useCustomMock: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useCustom: useCustomMock,
}));

describe("EndpointPerformanceCard", () => {
  beforeEach(() => {
    useCustomMock.mockReset().mockReturnValue({
      isLoading: false,
      data: {
        data: {
          status: "ok",
          window: "5m",
          metrics: {
            total_tokens_per_second: 505.75,
            l0_hit_rate: 0.35,
            l1_read_bytes_per_second: 536870912,
            hit_rate_cumulative: true,
          },
        },
      },
    });
  });

  it("shows the observed metrics and refetches for the selected window", () => {
    render(<EndpointPerformanceCard workspace="default" name="chat-ep" />);

    screen.getByText("505.8 tok/s");
    screen.getByText("35.0%");
    screen.getByText("512.0 MiB/s");
    screen.getByText("endpoints.performance.cumulative");

    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.performance.window1h" }),
    );
    expect(useCustomMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: "/endpoints/default/chat-ep/performance-observations?window=1h",
      }),
    );
  });

  it("hides the last observed metrics while the endpoint is paused", () => {
    render(
      <EndpointPerformanceCard workspace="default" name="chat-ep" paused />,
    );

    expect(screen.queryByText("505.8 tok/s")).toBeNull();
    expect(screen.queryByText("35.0%")).toBeNull();
  });
});
