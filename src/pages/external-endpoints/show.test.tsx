import { render, screen } from "@testing-library/react";
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

vi.mock("@/domains/external-endpoint/components/ModelRouteDetails", () => ({
  default: ({
    route,
    serviceUrl,
  }: {
    route: { model: string };
    serviceUrl?: string;
  }) => (
    <div data-testid="route-details" data-service-url={serviceUrl}>
      {route.model}
    </div>
  ),
}));

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

function record(status: Record<string, unknown>) {
  return {
    data: {
      metadata: {
        name: "model-lb",
        workspace: "default",
        creation_timestamp: "2026-01-01T00:00:00Z",
      },
      spec,
      status,
    },
  };
}

function renderPage(status: Record<string, unknown>, entry = "/") {
  useShowMock.mockReturnValue({
    query: { data: record(status), isLoading: false },
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
    expect(screen.getByTestId("loader")).toBeTruthy();
    loading.unmount();

    useShowMock.mockReturnValue({
      query: { data: undefined, isLoading: false },
    });
    render(<ExternalEndpointsShow />, { wrapper: MemoryRouter });
    expect(screen.getByText("pages.error.notFound")).toBeTruthy();
  });

  it("puts the timeout and the service URLs in the header, not a configuration block", () => {
    renderPage({
      phase: "Running",
      service_url: "https://gateway.example.com",
    });
    expect(screen.getByText("model-lb")).toBeTruthy();
    expect(screen.getByTestId("status-badge")).toBeTruthy();
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
    expect(screen.getByText("primary")).toBeTruthy();
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
    expect(screen.getByTestId("monitor")).toBeTruthy();
    expect(screen.getByTestId("monitor-link")).toBeTruthy();
  });
});
