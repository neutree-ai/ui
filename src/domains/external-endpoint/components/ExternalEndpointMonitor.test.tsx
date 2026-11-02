import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExternalEndpoint } from "@/domains/external-endpoint/types";

const { systemApiMock, language } = vi.hoisted(() => ({
  systemApiMock: vi.fn(),
  language: { resolvedLanguage: "en-US", language: "en-US" },
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: language }),
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
    language.resolvedLanguage = "en-US";
    language.language = "en-US";
  });

  it("explains that monitoring needs virtual model routing when there are no routes", () => {
    systemApiMock.mockReturnValue(systemApi());
    render(
      <ExternalEndpointMonitor record={endpoint({ model_routes: [] })} />,
      {
        wrapper: MemoryRouter,
      },
    );
    screen.getByText("external_endpoints.monitor.legacy");
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

  it("switches both dashboard variants with the resolved UI language", () => {
    systemApiMock.mockReturnValue(systemApi());
    const page = (
      <>
        <ExternalEndpointMonitor record={endpoint()} />
        <ExternalEndpointMonitorLink record={endpoint()} />
      </>
    );
    const { rerender } = render(page, { wrapper: MemoryRouter });
    for (const locale of ["zh-CN", "en-US"]) {
      language.resolvedLanguage = locale;
      // A stale Chinese preference in an English-only build must not select Chinese.
      language.language = "zh-CN";
      rerender(
        <>
          <ExternalEndpointMonitor record={endpoint()} />
          <ExternalEndpointMonitorLink record={endpoint()} />
        </>,
      );
      const suffix = locale === "zh-CN" ? "-zh-CN" : "";
      expect(
        screen
          .getByTestId("grafana-dashboard")
          .getAttribute("data-dashboard-id"),
      ).toBe(`neutree-model-routing-embed${suffix}`);
      const url = new URL(screen.getByRole("link").getAttribute("href")!);
      expect(url.pathname).toBe(`/d/neutree-model-routing${suffix}`);
      expect(url.searchParams.get("var-endpoint_literal")).toBe(
        '"/workspace/default/external-endpoint/model-lb"',
      );
    }
  });

  it("distinguishes loading, failure and unconfigured Grafana", () => {
    systemApiMock.mockReturnValue(
      systemApi({ grafanaUrl: undefined, isLoading: true }),
    );
    const loading = render(<ExternalEndpointMonitor record={endpoint()} />, {
      wrapper: MemoryRouter,
    });
    screen.getByText("external_endpoints.monitor.loading");
    loading.unmount();

    const refetch = vi.fn();
    systemApiMock.mockReturnValue(
      systemApi({ grafanaUrl: undefined, error: new Error("boom"), refetch }),
    );
    render(<ExternalEndpointMonitor record={endpoint()} />, {
      wrapper: MemoryRouter,
    });
    screen.getByText("external_endpoints.monitor.configError");
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
    screen.getByText("common.messages.grafanaNotConfigured");
  });
});

describe("ExternalEndpointMonitorLink", () => {
  beforeEach(() => {
    systemApiMock.mockReset();
    language.resolvedLanguage = "en-US";
    language.language = "en-US";
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
