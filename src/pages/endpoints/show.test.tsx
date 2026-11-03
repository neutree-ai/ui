import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCatalogFromEndpoint } from "@/domains/endpoint/lib/save-as-catalog";
import type { Endpoint } from "@/domains/endpoint/types";

const {
  advancedParametersProps,
  runtimeCardProps,
  useListMock,
  useOneMock,
  useShowMock,
  systemApiState,
} = vi.hoisted(() => ({
  advancedParametersProps: {
    current: null as { engineParameters: Record<string, unknown> } | null,
  },
  runtimeCardProps: {
    current: null as { clusterResourceInfo?: unknown } | null,
  },
  useListMock: vi.fn(),
  useOneMock: vi.fn(),
  useShowMock: vi.fn(),
  systemApiState: {
    clusterCacheProviders: [] as string[],
  },
}));

vi.mock("@refinedev/core", () => ({
  useCustom: () => ({ data: undefined, isLoading: false }),
  useList: useListMock,
  useOne: useOneMock,
  useShow: useShowMock,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children, value }: { children: ReactNode; value: string }) =>
    value === "basic" ? children : null,
  TabsList: () => null,
  TabsTrigger: () => null,
}));

vi.mock("@/domains/endpoint/components/EndpointRuntimeResourcesCard", () => ({
  default: (props: { clusterResourceInfo?: unknown }) => {
    runtimeCardProps.current = props;
    return <div data-testid="runtime-resources-card" />;
  },
  EndpointRuntimeResourcesSummary: () => null,
}));

vi.mock("@/domains/endpoint/components/EndpointSaveAsCatalogAction", () => ({
  EndpointSaveAsCatalogAction: () => null,
  EndpointSaveAsCatalogProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/foundation/components/ShowPage", () => {
  const ShowPage = ({ children }: { children: ReactNode }) => <>{children}</>;
  ShowPage.ObjectHeader = ({
    title,
    status,
    description,
  }: {
    title?: ReactNode;
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
    children,
    label,
  }: {
    children: ReactNode;
    label?: ReactNode;
  }) => (
    <span>
      <span>{label}</span>
      {children}
    </span>
  );
  ShowPage.Section = ({ children }: { children: ReactNode }) => <>{children}</>;
  return { ShowPage };
});

vi.mock("@/domains/cluster/lib/get-ray-dashboard-proxy", () => ({
  getRayDashboardProxy: () => null,
}));
vi.mock("@/domains/endpoint/components/EndpointAccessSummary", () => ({
  EndpointAccessSummary: () => null,
}));
vi.mock("@/domains/endpoint/components/EndpointAdvancedParameters", () => ({
  EndpointAdvancedParameters: (props: {
    engineParameters: Record<string, unknown>;
  }) => {
    advancedParametersProps.current = props;
    return null;
  },
}));
vi.mock("@/domains/endpoint/components/EndpointCatalogOrigin", () => ({
  EndpointCatalogOriginLink: () => null,
}));
vi.mock("@/domains/endpoint/components/EndpointEngine", () => ({
  default: () => null,
}));
vi.mock("@/domains/endpoint/components/EndpointModel", () => ({
  default: () => null,
}));
vi.mock("@/domains/endpoint/components/EndpointPauseAction", () => ({
  EndpointPauseAction: () => null,
}));
vi.mock("@/domains/endpoint/components/EndpointKVCacheSummary", () => ({
  EndpointKVCacheSummary: () => <div data-testid="endpoint-kv-cache-summary" />,
}));
vi.mock("@/domains/endpoint/components/ModelTask", () => ({
  default: () => null,
}));
vi.mock("@/domains/endpoint/hooks/use-endpoint-monitor-panels", () => ({
  useEndpointMonitorPanels: () => ({
    panels: [],
    selectedPanel: null,
    setSelectedPanel: vi.fn(),
    showMonitorTab: false,
    showSelector: false,
  }),
}));
vi.mock("@/domains/endpoint/lib/catalog-origin", () => ({
  readCatalogOrigin: () => null,
}));
vi.mock("@/domains/engine/lib/resolve-capabilities", () => ({
  resolvePlayground: () => ({ enabled: false }),
}));
vi.mock("@/foundation/components/EndpointStatus", () => ({
  default: () => <span data-testid="endpoint-status" />,
}));
vi.mock("@/foundation/components/GrafanaDashboard", () => ({
  default: () => null,
}));
vi.mock("@/foundation/components/Loader", () => ({
  Loader: () => null,
}));
vi.mock("@/foundation/components/SegmentedControl", () => ({
  SegmentedControl: () => null,
}));
vi.mock("@/foundation/components/ShowButton", () => ({
  ShowButton: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/foundation/components/Timestamp", () => ({ default: () => null }));
vi.mock("@/foundation/hooks/use-system-api", () => ({
  useSystemApi: () => ({
    grafanaUrl: null,
    systemInfo: {
      capabilities: {
        cluster_cache_providers: systemApiState.clusterCacheProviders,
      },
    },
  }),
}));
vi.mock("@/foundation/lib/grafana-dashboard-configs", () => ({
  getEndpointSplitDashboardProps: () => ({}),
}));

import { EndpointsShow } from "./show";

const endpoint = {
  metadata: {
    name: "endpoint-a",
    workspace: "workspace-a",
    creation_timestamp: "2026-08-28T00:00:00Z",
  },
  spec: {
    cluster: "cluster-a",
    engine: { engine: "vllm", version: "0.1.0" },
    model: { task: "chat" },
    resources: null,
    replicas: null,
    deployment_options: null,
    variables: null,
    env: null,
  },
  status: null,
} as unknown as Endpoint;

const clusterResourceInfo = {
  allocatable: null,
  available: null,
  node_resources: null,
  accelerator_metadata: {
    nvidia_gpu: {
      products: {
        "Tesla-T4": { memory_total_mib: 15 * 1024 },
      },
    },
  },
};

describe("EndpointsShow", () => {
  beforeEach(() => {
    runtimeCardProps.current = null;
    advancedParametersProps.current = null;
    systemApiState.clusterCacheProviders = [];
    useShowMock.mockReset();
    useOneMock.mockReset();
    useListMock.mockReset();
    useShowMock.mockReturnValue({
      query: { data: { data: endpoint }, isLoading: false },
    });
    useOneMock.mockReturnValue({ data: undefined });
    useListMock.mockReturnValue({
      data: {
        data: [
          {
            spec: { type: "kubernetes" },
            status: { resource_info: clusterResourceInfo },
          },
        ],
      },
    });
  });

  it("scopes the cluster lookup and passes its resource info to the runtime card", () => {
    render(<EndpointsShow />);

    expect(useListMock).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: { workspace: "workspace-a", workspaced: true },
        resource: "clusters",
      }),
    );
    expect(runtimeCardProps.current?.clusterResourceInfo).toBe(
      clusterResourceInfo,
    );
  });

  it("shows cache status when the platform supports ZCache", () => {
    systemApiState.clusterCacheProviders = ["zcache"];

    render(<EndpointsShow />);

    screen.getByTestId("endpoint-kv-cache-summary");
  });
  it.each(["Paused", "Deleted"])(
    "hides retained runtime allocations once the endpoint is %s",
    (phase) => {
      useShowMock.mockReturnValue({
        query: {
          data: {
            data: {
              ...endpoint,
              status: {
                phase,
                resources: {
                  replicas: [{ instance_id: "old-worker", devices: [] }],
                },
              },
            },
          },
          isLoading: false,
        },
      });

      render(<EndpointsShow />);

      expect(screen.queryByTestId("runtime-resources-card")).toBeNull();
    },
  );

  // A Flex endpoint deploys with no model, so the API omits spec.model. Reading
  // the task off it used to throw and blank the whole page.
  it("renders a model-free endpoint", () => {
    useShowMock.mockReturnValue({
      query: {
        data: {
          data: { ...endpoint, spec: { ...endpoint.spec, model: null } },
        },
        isLoading: false,
      },
    });

    render(<EndpointsShow />);

    screen.getByRole("heading", { name: "endpoint-a" });
  });

  // The identity line drops the badge rather than printing "name, -" before
  // the controller has reported a phase.
  it("only renders the status badge once a phase is reported", () => {
    const { unmount } = render(<EndpointsShow />);
    expect(screen.queryByTestId("endpoint-status")).toBeNull();
    unmount();

    useShowMock.mockReturnValue({
      query: {
        data: { data: { ...endpoint, status: { phase: "Running" } } },
        isLoading: false,
      },
    });
    render(<EndpointsShow />);
    screen.getByTestId("endpoint-status");
  });
  it("displays observed cache config without changing editable or catalog variables", () => {
    const args = Object.freeze({ max_model_len: 4096 });
    const config = { kv_connector: "LMCacheMPConnector", kv_role: "kv_both" };
    const record = {
      ...endpoint,
      spec: {
        ...endpoint.spec,
        variables: Object.freeze({ engine_args: args }),
      },
      status: {
        phase: "Paused",
        service_url: null,
        kv_cache: {
          provider: "zcache",
          details: { kv_transfer_config: config },
        },
      },
    };
    useShowMock.mockReturnValue({
      query: { data: { data: record }, isLoading: false },
    });
    const { rerender } = render(<EndpointsShow />);
    expect(advancedParametersProps.current?.engineParameters).toEqual({
      ...args,
      kv_transfer_config: config,
    });
    expect(record.spec.variables.engine_args).toEqual({ max_model_len: 4096 });
    expect(buildCatalogFromEndpoint(record as Endpoint, "copy")).toMatchObject({
      spec: { variables: { engine_args: args } },
    });

    // The next observation removed the argument: never retain the old display value.
    record.status.kv_cache.details =
      {} as typeof record.status.kv_cache.details;
    rerender(<EndpointsShow />);
    expect(advancedParametersProps.current?.engineParameters).toEqual(args);
  });

  it("does not add a placeholder for an older backend without cache status", () => {
    render(<EndpointsShow />);
    expect(advancedParametersProps.current?.engineParameters).toEqual({});
  });

  it("does not interpret another provider's details as zcache configuration", () => {
    useShowMock.mockReturnValue({
      query: {
        data: {
          data: {
            ...endpoint,
            status: {
              kv_cache: {
                provider: "other",
                details: { kv_transfer_config: { unrelated: true } },
              },
            },
          },
        },
        isLoading: false,
      },
    });
    render(<EndpointsShow />);
    expect(advancedParametersProps.current?.engineParameters).toEqual({});
  });

  it("shows all discovered served model names", () => {
    useShowMock.mockReturnValue({
      query: {
        data: {
          data: {
            ...endpoint,
            status: {
              served_models: ["chat-primary", "chat-alias"],
            },
          },
        },
        isLoading: false,
      },
    });
    render(<EndpointsShow />);
    screen.getByText("chat-primary");
    screen.getByText("chat-alias");
  });

  it("shows a placeholder while served models have not been discovered", () => {
    render(<EndpointsShow />);
    screen.getByText("endpoints.fields.servedModels");
    screen.getByText("-");
  });
});
