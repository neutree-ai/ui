import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

// Keep `t` stable across renders; several components list it as an effect dep.
vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock("@/foundation/lib/i18n", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      request_body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
      }),
      response_body: "{}",
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({ data: { data: [] } }),
  useShowButton: () => ({ label: "Show" }),
  useNavigation: () => ({
    list: vi.fn(),
    show: vi.fn(),
    create: vi.fn(),
    edit: vi.fn(),
    goBack: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useGo: () => vi.fn(),
}));

vi.mock("@/foundation/lib/api/ai-traces", () => ({
  fetchAITrace: vi.fn(),
}));

vi.mock("@/domains/api-key/components/ApiKeyLabel", () => ({
  ApiKeyLabel: () => <span>api-key</span>,
}));

vi.mock("@/foundation/components/Timestamp", () => ({
  default: () => <span>timestamp</span>,
}));

vi.mock("@/foundation/components/ShowButton", () => ({
  ShowButton: () => <button type="button">show</button>,
}));

import { RoutingDetails } from "./RoutingDetails";
import { TraceDetailDrawer } from "./TraceDetailDrawer";

const trace = {
  request_id: "req-1",
  time: "2026-09-18T08:00:00Z",
  workspace: "default",
  endpoint_type: "external",
  endpoint_name: "endpoint-1",
  response_status: 200,
};

describe("TraceDetailDrawer", () => {
  it("offers the formatted/raw switch for a request body it can format", () => {
    render(
      <TooltipProvider>
        <TraceDetailDrawer trace={trace} open onOpenChange={vi.fn()} />
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("button", {
        name: "ai_traces.detail.viewFormatted",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "ai_traces.detail.viewRaw" }),
    ).toBeTruthy();
  });
});

describe("RoutingDetails", () => {
  it("distinguishes an old log from a request that could not select a target", () => {
    const { rerender } = render(<RoutingDetails />);
    expect(screen.getByText("ai_traces.routing.unrecorded")).toBeTruthy();
    rerender(
      <RoutingDetails
        routing={{ result: "unassigned", reason: "capacity_exhausted" }}
      />,
    );
    expect(screen.queryByText("ai_traces.routing.unrecorded")).toBeNull();
    expect(
      screen.getByText("ai_traces.routing.reasons.capacity_exhausted"),
    ).toBeTruthy();
  });
  it("shows captured candidates and reports a truncated history", () => {
    render(
      <RoutingDetails
        routing={{
          result: "selected",
          reason: "capacity_filtered",
          selected: {
            upstream: "b",
            upstream_model: "m2",
            priority: 1,
            weight: 1,
            max_inflight_requests: 0,
            inflight: 0,
          },
          skipped: [
            {
              upstream: "a",
              upstream_model: "m1",
              priority: 0,
              weight: 1,
              max_inflight_requests: 2,
              inflight: 2,
              reason: "capacity_exhausted",
            },
          ],
          skipped_total: 40,
        }}
      />,
    );
    expect(screen.getByText("b / m2")).toBeTruthy();
    expect(screen.getByText("a / m1")).toBeTruthy();
    expect(screen.getByText("ai_traces.routing.truncated")).toBeTruthy();
  });
});
