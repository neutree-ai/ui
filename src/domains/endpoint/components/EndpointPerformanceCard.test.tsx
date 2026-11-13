import { fireEvent, render, screen, within } from "@testing-library/react";
import dayjs from "dayjs";
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
          series: [
            {
              metric: "ttft_p95_seconds",
              unit: "seconds",
              points: [{ timestamp: 100, value: 0.18 }],
            },
            {
              metric: "ttft_avg_seconds",
              unit: "seconds",
              points: [{ timestamp: 100, value: 0.12 }],
            },
            {
              metric: "tpot_p95_seconds",
              unit: "seconds",
              points: [{ timestamp: 100, value: 0.032 }],
            },
            {
              metric: "tpot_avg_seconds",
              unit: "seconds",
              points: [{ timestamp: 100, value: 0.024 }],
            },
            {
              metric: "prompt_tokens_per_second",
              unit: "tokens_per_second",
              points: [{ timestamp: 100, value: 420 }],
            },
            {
              metric: "generation_tokens_per_second",
              unit: "tokens_per_second",
              points: [{ timestamp: 100, value: 85.75 }],
            },
            {
              metric: "total_tokens_per_second",
              unit: "tokens_per_second",
              points: [{ timestamp: 100, value: 505.75 }],
            },
            {
              metric: "l0_hit_rate",
              unit: "ratio",
              points: [{ timestamp: 100, value: 0.46 }],
            },
            {
              metric: "l1_hit_rate",
              unit: "ratio",
              points: [{ timestamp: 100, value: 0.63 }],
            },
            {
              metric: "l1_read_bytes_per_second",
              unit: "bytes_per_second",
              points: [{ timestamp: 100, value: 536870912 }],
            },
            {
              metric: "l1_write_bytes_per_second",
              unit: "bytes_per_second",
              points: [{ timestamp: 100, value: 134217728 }],
            },
          ],
        },
      },
    });
  });

  it("uses the latest trend point for current values and refetches the selected window", () => {
    render(<EndpointPerformanceCard workspace="default" name="chat-ep" />);

    screen.getByText("505.8 tok/s");
    screen.getAllByText("endpoints.performance.totalTokensPerSecond");
    screen.getAllByText("endpoints.performance.l0HitRate");
    screen.getAllByText("endpoints.performance.l1HitRate");
    expect(screen.queryByText(/^endpoints\.performance\.current/)).toBeNull();
    screen.getByText("46.0%");
    screen.getByText("63.0%");
    screen.getByRole("img", {
      name: "endpoints.performance.trendAriaLabel:endpoints.performance.latency",
    });
    screen.getByRole("img", {
      name: "endpoints.performance.trendAriaLabel:endpoints.performance.hitRateMetric",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.performance.window1h" }),
    );
    expect(useCustomMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/endpoints/default/chat-ep/performance-trends?window=1h",
      }),
    );
  });

  it("switches KV cache between hit rate and read/write trends", () => {
    render(<EndpointPerformanceCard workspace="default" name="chat-ep" />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "endpoints.performance.readWriteMetric",
      }),
    );

    screen.getByText("512.0 MiB/s");
    screen.getByText("128.0 MiB/s");
    screen.getByRole("img", {
      name: "endpoints.performance.trendAriaLabel:endpoints.performance.readWriteMetric",
    });
  });

  it("fetches a manually selected absolute time range", () => {
    render(<EndpointPerformanceCard workspace="default" name="chat-ep" />);

    const start = dayjs().subtract(30, "minute");
    const end = dayjs().subtract(1, "minute");

    fireEvent.click(
      screen.getByRole("button", {
        name: "endpoints.performance.customRange",
      }),
    );
    fireEvent.change(screen.getByLabelText("endpoints.performance.startTime"), {
      target: { value: start.format("YYYY-MM-DDTHH:mm:ss") },
    });
    fireEvent.change(screen.getByLabelText("endpoints.performance.endTime"), {
      target: { value: end.format("YYYY-MM-DDTHH:mm:ss") },
    });
    fireEvent.click(screen.getByRole("button", { name: "buttons.apply" }));

    expect(useCustomMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `/endpoints/default/chat-ep/performance-trends?start=${start.unix()}&end=${end.unix()}`,
      }),
    );
  });

  it("shows TTFT and TPOT trends in the same latency chart", () => {
    render(<EndpointPerformanceCard workspace="default" name="chat-ep" />);

    const chart = screen.getByRole("img", {
      name: "endpoints.performance.trendAriaLabel:endpoints.performance.latency",
    });
    within(chart).getByText(
      "endpoints.performance.ttft endpoints.performance.p95",
    );
    within(chart).getByText(
      "endpoints.performance.ttft endpoints.performance.avg",
    );
    within(chart).getByText(
      "endpoints.performance.tpot endpoints.performance.p95",
    );
    within(chart).getByText(
      "endpoints.performance.tpot endpoints.performance.avg",
    );
  });

  it("shows historical trends without auto-refreshing while the endpoint is paused", () => {
    render(
      <EndpointPerformanceCard workspace="default" name="chat-ep" paused />,
    );

    screen.getByText("505.8 tok/s");
    screen.getByText("46.0%");
    expect(useCustomMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/endpoints/default/chat-ep/performance-trends?window=5m",
        queryOptions: expect.objectContaining({
          enabled: true,
          refetchInterval: false,
        }),
      }),
    );
  });

  it("omits KV cache metrics when the endpoint cannot use the cache", () => {
    render(
      <EndpointPerformanceCard
        name="chat-ep"
        showKvCache={false}
        workspace="default"
      />,
    );

    expect(screen.queryByText("endpoints.performance.kvCache")).toBeNull();
    expect(screen.queryByText("46.0%")).toBeNull();
    expect(
      screen.queryByRole("img", {
        name: "endpoints.performance.trendAriaLabel:endpoints.performance.kvCache",
      }),
    ).toBeNull();
  });
});
