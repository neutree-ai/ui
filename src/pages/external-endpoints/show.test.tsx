import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useShowMock } = vi.hoisted(() => ({ useShowMock: vi.fn() }));

vi.mock("@refinedev/core", () => ({
  useShow: useShowMock,
  useNavigation: () => ({
    editUrl: (resource: string, name: string) => `/edit/${resource}/${name}`,
  }),
}));

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspace: () => ({ current: "default" }),
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock("@/foundation/components/ShowPage", () => {
  const ShowPage = ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  );
  ShowPage.ObjectHeader = ({
    title,
    status,
    description,
  }: {
    title: ReactNode;
    status?: ReactNode;
    description?: ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      {status}
      {description}
    </header>
  );
  ShowPage.Meta = ({
    label,
    children,
  }: {
    label: ReactNode;
    children: ReactNode;
  }) => (
    <span>
      {label}: {children}
    </span>
  );
  ShowPage.Section = ({
    title,
    children,
  }: {
    title?: ReactNode;
    children: ReactNode;
  }) => (
    <section>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
  return { ShowPage };
});

vi.mock("@/domains/endpoint/components/EndpointAccessSummary", () => ({
  EndpointAccessSummary: ({ serviceUrl }: { serviceUrl: string }) => (
    <div data-testid="access-summary">{serviceUrl}</div>
  ),
}));

vi.mock(
  "@/domains/external-endpoint/components/ExternalEndpointStatus",
  () => ({
    default: () => <span data-testid="status-badge" />,
  }),
);

vi.mock("@/domains/external-endpoint/components/FailedUpstreamAlert", () => ({
  default: () => <div data-testid="failed-upstream" />,
}));

vi.mock("@/domains/external-endpoint/components/UpstreamStatusBadge", () => ({
  default: () => <div data-testid="upstream-status" />,
}));

vi.mock(
  "@/domains/external-endpoint/components/ModelRouteDetails",
  async () => {
    const { ModelSourceBadge } = await import(
      "@/foundation/components/ModelSourceBadge"
    );
    return {
      default: ({
        route,
        serviceUrl,
        source,
        onViewMonitoring,
      }: {
        route: { model: string };
        serviceUrl?: string;
        source?: string;
        onViewMonitoring?: () => void;
      }) => (
        <div
          data-testid="route-details"
          data-service-url={serviceUrl}
          data-monitoring={!!onViewMonitoring}
        >
          {route.model}
          <ModelSourceBadge source={source} />
        </div>
      ),
    };
  },
);

vi.mock(
  "@/domains/external-endpoint/components/ExternalEndpointMonitor",
  () => ({
    default: () => <div data-testid="monitor" />,
    ExternalEndpointMonitorLink: () => (
      <a data-testid="monitor-link" href="/d/x">
        external_endpoints.monitor.openGrafana
      </a>
    ),
  }),
);

vi.mock("@/foundation/components/MetadataTimestampMeta", () => ({
  MetadataTimestampMeta: () => <span data-testid="timestamp" />,
}));

vi.mock("@/foundation/components/Loader", () => ({
  Loader: () => <div data-testid="loader" />,
}));

import { ExternalEndpointsShow } from "./show";

const spec = {
  timeout: 30000,
  upstreams: [
    {
      name: "primary",
      upstream: { url: "https://api.example.com" },
      model_mapping: { "gpt-6-astra": "gpt-6" },
      models: ["gpt-6"],
    },
  ],
  model_routes: [
    {
      model: "gpt-6-astra",
      strategy: "fixed",
      targets: [{ upstream: "primary", upstream_model: "gpt-6" }],
    },
  ],
};

function record(
  status: Record<string, unknown>,
  endpointSpec: Record<string, unknown> = spec,
) {
  return {
    data: {
      metadata: {
        name: "model-lb",
        workspace: "default",
        creation_timestamp: "2026-01-01T00:00:00Z",
      },
      spec: endpointSpec,
      status,
    },
  };
}

function renderPage(
  status: Record<string, unknown>,
  entry = "/",
  endpointSpec: Record<string, unknown> = spec,
) {
  useShowMock.mockReturnValue({
    query: { data: record(status, endpointSpec), isLoading: false },
  });
  return render(<ExternalEndpointsShow />, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
    ),
  });
}

describe("ExternalEndpointsShow", () => {
  beforeEach(() => {
    useShowMock.mockReset();
  });

  it("renders loading and missing-record states", () => {
    useShowMock.mockReturnValue({
      query: { data: undefined, isLoading: true },
    });
    const loading = render(<ExternalEndpointsShow />, {
      wrapper: MemoryRouter,
    });
    screen.getByTestId("loader");
    loading.unmount();

    useShowMock.mockReturnValue({
      query: { data: undefined, isLoading: false },
    });
    render(<ExternalEndpointsShow />, { wrapper: MemoryRouter });
    screen.getByText("pages.error.notFound");
  });

  it("puts the timeout and the service URLs in the header, not a configuration block", () => {
    renderPage({
      phase: "Running",
      service_url: "https://gateway.example.com",
    });
    screen.getByText("model-lb");
    screen.getByTestId("status-badge");
    expect(
      screen.getByText("external_endpoints.fields.timeout: 30s"),
    ).toBeTruthy();
    expect(screen.getByTestId("access-summary").textContent).toBe(
      "https://gateway.example.com",
    );
    expect(
      screen.getByTestId("route-details").getAttribute("data-service-url"),
    ).toBe("https://gateway.example.com");
    expect(screen.getAllByText("common.tabs.basic")).toHaveLength(1);
    expect(screen.getAllByText("common.tabs.monitor")).toHaveLength(1);
  });

  it("drops the status badge when the controller has reported no phase", () => {
    renderPage({ service_url: "https://gateway.example.com" });
    expect(screen.queryByTestId("status-badge")).toBeNull();
  });

  it("lists each upstream's model mappings behind the disclosure", () => {
    renderPage({
      phase: "Running",
      service_url: "https://gateway.example.com",
    });
    expect(
      screen.getByText("external_endpoints.sections.modelServices"),
    ).toBeTruthy();
    screen.getByText("primary");
    expect(
      screen.getByText("external_endpoints.options.upstreamTypeExternal"),
    ).toBeTruthy();
    expect(
      screen.getByText("external_endpoints.actions.viewModelMappings"),
    ).toBeTruthy();
    const table = screen.getByRole("table");
    expect(table.textContent).toContain("gpt-6");
    expect(table.textContent).toContain("gpt-6-astra");
  });

  it("offers the deep link in the tab row on the monitor tab", () => {
    renderPage(
      { phase: "Running", service_url: "https://gateway.example.com" },
      "/?tab=monitor",
    );
    screen.getByTestId("monitor");
    screen.getByTestId("monitor-link");
  });

  it.each([undefined, null])(
    "renders legacy models in route cards when routes are %s",
    (model_routes) => {
      renderPage({}, "/", {
        ...spec,
        model_routes,
        model_sources: { "model-010": "third-party-public" },
        upstreams: [
          {
            upstream: { url: "https://api.example.com" },
            model_mapping: {
              "model-008": "upstream-model-009",
              "model-010": "upstream-model-010",
            },
          },
        ],
      });
      const cards = screen.getAllByTestId("route-details");
      expect(cards).toHaveLength(2);
      expect(cards[0].textContent).toContain("model-008");
      expect(
        within(cards[0]).getByText("modelSource.unspecified"),
      ).toBeTruthy();
      expect(cards[1].textContent).toContain("model-010");
      within(cards[1]).getByText("third-party-public");
      expect(cards[0].getAttribute("data-monitoring")).toBe("false");
    },
  );

  it("keeps the inferred source of a legacy internal target", () => {
    renderPage({}, "/", {
      ...spec,
      model_routes: null,
      upstreams: [{ endpoint_ref: "qwen", model_mapping: { chat: "qwen" } }],
    });
    expect(
      within(screen.getByTestId("route-details")).getByText("self-hosted"),
    ).toBeTruthy();
  });

  it("does not restore explicitly empty routes from legacy mappings", () => {
    renderPage({}, "/", { ...spec, model_routes: [] });
    expect(screen.queryByTestId("route-details")).toBeNull();
  });
});
