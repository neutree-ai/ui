import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EndpointPerformanceCard } from "./EndpointPerformanceCard";

const { useCustomMock } = vi.hoisted(() => ({
  useCustomMock: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useCustom: useCustomMock,
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("EndpointPerformanceCard", () => {
  beforeEach(() => {
    useCustomMock.mockReset();
  });

  it("renders latency, throughput, and KV-cache metrics and switches windows", () => {
    useCustomMock.mockReturnValue({
      isLoading: false,
      data: {
        data: {
          status: "ok",
          window: "5m",
          metrics: {
            ttft_p95_seconds: 0.185,
            ttft_avg_seconds: 0.12,
            tpot_p95_seconds: 0.032,
            tpot_avg_seconds: 0.024,
            latency_cumulative: true,
            prompt_tokens_per_second: 420.5,
            generation_tokens_per_second: 85.25,
            total_tokens_per_second: 505.75,
            l0_hit_rate: 0.35,
            l1_hit_rate: 0.48,
            hit_rate_cumulative: true,
            l1_read_bytes_per_second: 536870912,
            l1_write_bytes_per_second: 134217728,
          },
        },
      },
    });

    render(<EndpointPerformanceCard workspace="default" name="chat-ep" />);

    expect(screen.getByTestId("perf-ttft-value").textContent).toBe("185 ms");
    expect(screen.getByTestId("perf-tpot-value").textContent).toBe("32 ms");
    expect(screen.getByTestId("perf-latency-cumulative")).toBeTruthy();
    expect(screen.getByTestId("perf-tps-value").textContent).toBe(
      "505.8 tok/s",
    );
    expect(screen.getByTestId("perf-prompt-tps-value").textContent).toBe(
      "420.5 tok/s",
    );
    expect(screen.getByTestId("perf-gen-tps-value").textContent).toBe(
      "85.25 tok/s",
    );
    expect(screen.getByTestId("perf-l0-hit-rate").textContent).toBe("35.0%");
    expect(screen.getByTestId("perf-l1-hit-rate").textContent).toBe("48.0%");
    expect(screen.getByTestId("perf-cache-cumulative")).toBeTruthy();
    expect(screen.getByTestId("perf-l1-read-speed").textContent).toBe(
      "512.0 MB/s",
    );
    expect(screen.getByTestId("perf-l1-write-speed").textContent).toBe(
      "128.0 MB/s",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "endpoints.performance.window1h" }),
    );
    expect(useCustomMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: "/endpoints/default/chat-ep/performance-observations",
        config: { query: { window: "1h" } },
      }),
    );
  });

  it("shows dashes when endpoint is paused", () => {
    useCustomMock.mockReturnValue({
      isLoading: false,
      data: undefined,
    });

    render(
      <EndpointPerformanceCard workspace="default" name="chat-ep" paused />,
    );

    expect(screen.getByTestId("perf-ttft-value").textContent).toBe("—");
    expect(screen.getByTestId("perf-tpot-value").textContent).toBe("—");
    expect(screen.getByTestId("perf-tps-value").textContent).toBe("—");
    expect(screen.getByTestId("perf-l0-hit-rate").textContent).toBe("—");
    expect(screen.getByTestId("perf-l1-hit-rate").textContent).toBe("—");
    expect(screen.getByTestId("perf-l1-read-speed").textContent).toBe("—");
    expect(screen.getByTestId("perf-l1-write-speed").textContent).toBe("—");
  });
});
