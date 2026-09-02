import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Endpoint } from "@/domains/endpoint/types";

const { runtimeCardProps, useListMock, useOneMock, useShowMock } = vi.hoisted(
  () => ({
    runtimeCardProps: {
      current: null as { clusterResourceInfo?: unknown } | null,
    },
    useListMock: vi.fn(),
    useOneMock: vi.fn(),
    useShowMock: vi.fn(),
  }),
);

vi.mock("@refinedev/core", () => ({
  useList: useListMock,
  useOne: useOneMock,
  useShow: useShowMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
  ShowPage.ObjectHeader = () => null;
  ShowPage.Meta = ({ children }: { children: ReactNode }) => <>{children}</>;
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
  EndpointAdvancedParameters: () => null,
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
  default: () => null,
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
  useSystemApi: () => ({ grafanaUrl: null }),
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

  // A Flex endpoint deploys with no model, so the API omits spec.model. Reading
  // the task off it used to throw and blank the whole page (NEU-728).
  it("renders a model-free endpoint", () => {
    useShowMock.mockReturnValue({
      query: {
        data: {
          data: { ...endpoint, spec: { ...endpoint.spec, model: null } },
        },
        isLoading: false,
      },
    });

    expect(() => render(<EndpointsShow />)).not.toThrow();
  });
});
