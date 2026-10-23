import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useHasPermission } from "@/foundation/hooks/use-has-permission";
import { LogForwardingButton } from "./LogForwardingButton";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

vi.mock("@/foundation/hooks/use-has-permission", () => ({
  useHasPermission: vi.fn(() => true),
}));

const state = vi.hoisted(() => ({
  sinks: [] as unknown[],
  listCall: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useList: (options: unknown) => {
    state.listCall(options);
    return { data: { data: state.sinks } };
  },
  useNavigation: () => ({
    listUrl: (resource: string) =>
      resource === "log_sinks" ? "/log-forwarding" : "",
  }),
}));

vi.mock("@/foundation/components/Link", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const sink = (phase: string, enabled?: boolean) => ({
  metadata: { name: phase.toLowerCase(), deletion_timestamp: null },
  spec: { type: "victorialogs", enabled },
  status: { phase },
});

const renderButton = () =>
  render(
    <TooltipProvider>
      <LogForwardingButton />
    </TooltipProvider>,
  );

const button = () => screen.getByTestId("log-forwarding-button");
const alertDot = () => screen.queryByTestId("log-forwarding-alert");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useHasPermission).mockReturnValue(true);
  state.sinks = [];
});

describe("LogForwardingButton", () => {
  it("is hidden without log_sink:read and does not read the sinks", () => {
    vi.mocked(useHasPermission).mockReturnValue(false);

    renderButton();

    expect(useHasPermission).toHaveBeenCalledWith("log_sink:read");
    expect(screen.queryByTestId("log-forwarding-button")).toBeNull();
    expect(state.listCall).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: "log_sinks",
        queryOptions: expect.objectContaining({ enabled: false }),
      }),
    );
  });

  it("links to the Log Forwarding page", () => {
    renderButton();

    expect(button().getAttribute("href")).toBe("/log-forwarding");
  });

  it("shows no count and no dot when nothing is enabled", () => {
    state.sinks = [sink("Disabled", false)];

    renderButton();

    expect(button().textContent).toBe("ai_traces.forwarding.button");
    expect(alertDot()).toBeNull();
  });

  it("counts the enabled destinations", () => {
    state.sinks = [
      sink("Running"),
      sink("Pending", true),
      sink("Disabled", false),
    ];

    renderButton();

    expect(button().textContent).toBe("ai_traces.forwarding.buttonWithCount:2");
    expect(alertDot()).toBeNull();
  });

  it("shows a red dot when a destination is failing, even if another is degraded", () => {
    state.sinks = [sink("Failed"), sink("Degraded"), sink("Running")];

    renderButton();

    expect(alertDot()?.getAttribute("data-alert")).toBe("failed");
    expect(alertDot()?.className).toContain("serious");
    expect(button().textContent).toContain("ai_traces.forwarding.failing:1");
  });

  it("shows a yellow dot when a destination is degraded and none is failing", () => {
    state.sinks = [sink("Degraded"), sink("Running")];

    renderButton();

    expect(alertDot()?.getAttribute("data-alert")).toBe("degraded");
    expect(alertDot()?.className).toContain("notice");
    expect(button().textContent).toContain("ai_traces.forwarding.degraded:1");
  });
});
