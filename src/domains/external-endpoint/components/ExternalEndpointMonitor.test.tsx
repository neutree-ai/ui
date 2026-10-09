import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExternalEndpoint } from "@/domains/external-endpoint/types";

const { systemApiMock } = vi.hoisted(() => ({ systemApiMock: vi.fn() }));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("@/foundation/hooks/use-system-api", () => ({
  useSystemApi: () => systemApiMock(),
}));

vi.mock("@/foundation/components/GrafanaDashboard", () => ({
  default: (props: { dashboardConfig: { dashboardId: string } }) => (
    <div
      data-testid="grafana-dashboard"
      data-dashboard-id={props.dashboardConfig.dashboardId}
    />
  ),
}));

import ExternalEndpointMonitor, {
  ExternalEndpointMonitorLink,
} from "./ExternalEndpointMonitor";

const grafanaUrl = "https://grafana.example.com";

function endpoint(spec: Partial<ExternalEndpoint["spec"]> = {}) {
  return {
    metadata: { name: "model-lb", workspace: "default" },
    spec: {
      timeout: 30,
      upstreams: [],
      model_routes: [
        {
          model: "gpt-6-astra",
          strategy: "fixed",
          targets: [{ upstream: "openai", upstream_model: "gpt-6" }],
        },
      ],
      ...spec,
    },
  } as unknown as ExternalEndpoint;
}

function systemApi(overrides: Record<string, unknown> = {}) {
  return {
    grafanaUrl,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

describe("ExternalEndpointMonitor", () => {
  beforeEach(() => {
    systemApiMock.mockReset();
  });

  it("explains that monitoring needs virtual model routing when there are no routes", () => {
    systemApiMock.mockReturnValue(systemApi());
    render(
      <ExternalEndpointMonitor record={endpoint({ model_routes: [] })} />,
      {
        wrapper: MemoryRouter,
      },
    );
    expect(screen.getByText("external_endpoints.monitor.legacy")).toBeTruthy();
    expect(screen.queryByTestId("grafana-dashboard")).toBeNull();
  });

  it("embeds the model routing dashboard once Grafana is configured", () => {
    systemApiMock.mockReturnValue(systemApi());
    render(<ExternalEndpointMonitor record={endpoint()} />, {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={["/?model=gpt-6-astra&from=now-6h"]}>
          {children}
        </MemoryRouter>
      ),
    });
    expect(
      screen.getByTestId("grafana-dashboard").getAttribute("data-dashboard-id"),
    ).toBe("neutree-model-routing-embed");
  });

  it("distinguishes loading, failure and unconfigured Grafana", () => {
    systemApiMock.mockReturnValue(
      systemApi({ grafanaUrl: undefined, isLoading: true }),
    );
    const loading = render(<ExternalEndpointMonitor record={endpoint()} />, {
      wrapper: MemoryRouter,
    });
    expect(screen.getByText("external_endpoints.monitor.loading")).toBeTruthy();
    loading.unmount();

    const refetch = vi.fn();
    systemApiMock.mockReturnValue(
      systemApi({ grafanaUrl: undefined, error: new Error("boom"), refetch }),
    );
    render(<ExternalEndpointMonitor record={endpoint()} />, {
      wrapper: MemoryRouter,
    });
    expect(
      screen.getByText("external_endpoints.monitor.configError"),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "external_endpoints.monitor.retry" }),
    );
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to the not-configured copy rather than an empty frame", () => {
    systemApiMock.mockReturnValue(systemApi({ grafanaUrl: undefined }));
    render(<ExternalEndpointMonitor record={endpoint()} />, {
      wrapper: MemoryRouter,
    });
    expect(
      screen.getByText("common.messages.grafanaNotConfigured"),
    ).toBeTruthy();
  });
});

describe("ExternalEndpointMonitorLink", () => {
  beforeEach(() => {
    systemApiMock.mockReset();
  });

  it("opens the full dashboard in Grafana without the kiosk flag", () => {
    systemApiMock.mockReturnValue(systemApi());
    render(<ExternalEndpointMonitorLink record={endpoint()} />, {
      wrapper: MemoryRouter,
    });
    const link = screen.getByRole("link");
    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("/d/neutree-model-routing");
    expect(href).not.toContain("kiosk");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.textContent).toBe("external_endpoints.monitor.openGrafana");
  });

  it("renders nothing when there is no dashboard to open", () => {
    systemApiMock.mockReturnValue(systemApi());
    const noRoutes = render(
      <ExternalEndpointMonitorLink record={endpoint({ model_routes: [] })} />,
      { wrapper: MemoryRouter },
    );
    expect(noRoutes.container.querySelector("a")).toBeNull();

    systemApiMock.mockReturnValue(systemApi({ grafanaUrl: undefined }));
    const noGrafana = render(
      <ExternalEndpointMonitorLink record={endpoint()} />,
      { wrapper: MemoryRouter },
    );
    expect(noGrafana.container.querySelector("a")).toBeNull();
  });
});
