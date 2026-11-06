import { fireEvent, render as renderUI, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeGpuDevice,
  makeNodeResources,
  makeResourceInfo,
} from "@/foundation/testing/resource-builders";

const render = (ui: ReactNode) => renderUI(ui, { wrapper: MemoryRouter });

const { useShowMock } = vi.hoisted(() => ({
  useShowMock: vi.fn(),
}));
const systemCapabilities = vi.hoisted(() => ({
  cacheProviders: ["zcache"] as string[],
}));

vi.mock("@refinedev/core", () => ({
  useShow: useShowMock,
  useCustom: () => ({ data: undefined, isLoading: false }),
  useList: () => ({ data: { data: [] } }),
  useTranslation: () => ({ translate: (key: string) => key }),
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock("@/domains/cluster/components/ClusterResourceSummary", () => ({
  ClusterResourceSummary: ({ resourceInfo }: { resourceInfo: unknown }) => (
    <div data-testid="cluster-resource-summary">
      {JSON.stringify(resourceInfo)}
    </div>
  ),
}));

vi.mock("@/domains/cluster/components/ClusterCacheSection", () => ({
  ClusterCacheSection: () => <div data-testid="cluster-cache-section" />,
}));

vi.mock("@/foundation/components/ShowPage", () => {
  const ShowPage = ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  );
  ShowPage.ObjectHeader = ({ title }: { title: ReactNode }) => <h1>{title}</h1>;
  ShowPage.Meta = ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  );
  ShowPage.Section = ({
    title,
    actions,
    children,
  }: {
    title?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
  }) => (
    <section>
      {title && <h2>{title}</h2>}
      {actions}
      {children}
    </section>
  );
  ShowPage.Row = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return { ShowPage };
});

vi.mock("@/domains/cluster/components/ClusterUpgradeAction", () => ({
  ClusterUpgradeAction: () => null,
  ClusterUpgradeProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/domains/cluster/components/ClusterUpgradeTip", () => ({
  ClusterUpgradeTip: () => null,
}));
vi.mock("@/domains/cluster/components/ClusterStatus", () => ({
  default: () => null,
}));
vi.mock("@/domains/cluster/components/ClusterType", () => ({
  default: () => null,
}));
vi.mock("@/domains/endpoint/components/EndpointEngine", () => ({
  default: () => null,
}));
vi.mock("@/domains/endpoint/components/EndpointModel", () => ({
  default: () => null,
}));
vi.mock("@/domains/endpoint/components/EndpointStatus", () => ({
  default: () => null,
}));
vi.mock("@/foundation/components/GrafanaDashboard", () => ({
  default: () => null,
}));
vi.mock("@/foundation/components/ShowButton", () => ({
  ShowButton: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/foundation/components/Timestamp", () => ({ default: () => null }));
vi.mock("@/foundation/components/Table", () => {
  const Table = ({ children }: { children: ReactNode }) => (
    <div data-testid="endpoint-table">{children}</div>
  );
  Table.Column = () => null;
  return { Table };
});
vi.mock("@/foundation/components/metadata-columns", () => ({
  useMetadataColumns: () => ({ name: null, creation_timestamp: null }),
}));
vi.mock("@/domains/cluster/hooks/use-cluster-monitor-panels", () => ({
  useClusterMonitorPanels: () => ({
    selectedPanel: null,
    showMonitorTab: false,
  }),
}));
vi.mock("@/foundation/hooks/use-system-api", () => ({
  useSystemApi: () => ({
    grafanaUrl: null,
    systemInfo: {
      capabilities: {
        cluster_cache_providers: systemCapabilities.cacheProviders,
      },
    },
  }),
}));

import { ClustersShow } from "./show";

const showCluster = ({
  name = "gpu-cluster",
  spec = {},
  status = {},
}: {
  name?: string;
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
} = {}) =>
  useShowMock.mockReturnValue({
    query: {
      isLoading: false,
      data: {
        data: {
          metadata: {
            name,
            workspace: "design-lab",
            creation_timestamp: "2026-08-25T00:00:00Z",
          },
          spec: {
            type: "kubernetes",
            version: "v1.2.0",
            image_registry: "default",
            accelerator_virtualization: { enabled: true },
            config: {},
            ...spec,
          },
          status,
        },
      },
    },
  });

describe("ClustersShow", () => {
  beforeEach(() => {
    useShowMock.mockReset();
    window.localStorage.clear();
    systemCapabilities.cacheProviders = ["zcache"];
  });

  it("renders loading and missing-record states", () => {
    useShowMock.mockReturnValueOnce({
      query: { data: undefined, isLoading: true },
    });
    const loading = render(<ClustersShow />);
    expect(loading.container.querySelector("title")?.textContent).toBe(
      "Loading...",
    );
    loading.unmount();

    useShowMock.mockReturnValueOnce({
      query: { data: undefined, isLoading: false },
    });
    render(<ClustersShow />);
    screen.getByText("clusters.messages.notFound");
  });

  it("defaults to cards and remembers the GPU view across clusters", () => {
    const status = {
      phase: "Running",
      version: "v1.2.0",
      resource_info: {
        allocatable: makeResourceInfo(16, 64, { "Tesla-T4": 1 }),
        available: null,
        node_resources: {
          "node-a": makeNodeResources({ devices: [makeGpuDevice("gpu-a")] }),
        },
      },
    };
    showCluster({ status });

    const firstCluster = render(<ClustersShow />);

    screen.getByRole("heading", { level: 1, name: "gpu-cluster" });
    expect(
      screen.getByTestId("cluster-resource-summary").textContent,
    ).toContain('"cpu":16');
    expect(screen.queryByText("observations.flops")).toBeNull();
    screen.getByText("node-a");
    expect(
      screen
        .getByRole("button", { name: "clusters.options.cardView" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    screen.getByTestId("gpu-inventory-card");

    fireEvent.click(
      screen.getByRole("button", { name: "clusters.options.tableView" }),
    );
    screen.getByTestId("gpu-inventory-row");
    expect(screen.queryByTestId("gpu-inventory-card")).toBeNull();

    firstCluster.unmount();
    showCluster({ name: "another-gpu-cluster", status });
    render(<ClustersShow />);

    screen.getByRole("heading", {
      level: 1,
      name: "another-gpu-cluster",
    });
    screen.getByTestId("gpu-inventory-row");
  });

  // The API requires router.replicas / resources.cpu / resources.memory for a
  // Kubernetes cluster, so a record without them can only come from a gap in
  // the data. Each row still shows the placeholder rather than an empty cell.
  it("shows the placeholder for a router that reports no capacity", () => {
    showCluster({
      spec: {
        config: {
          kubernetes_config: { router: { access_mode: "LoadBalancer" } },
        },
      },
      status: { phase: "Running", version: "v1.2.0" },
    });

    render(<ClustersShow />);

    expect(screen.getAllByTestId("empty-value")).toHaveLength(3);
  });

  it("still renders the page for a cluster with no phase yet", () => {
    showCluster();

    render(<ClustersShow />);

    screen.getByRole("heading", { level: 1, name: "gpu-cluster" });
    screen.getByTestId("endpoint-table");
  });

  it("moves KV cache into its own tab for Kubernetes clusters", () => {
    showCluster();

    render(<ClustersShow />);

    screen.getByText("clusters.cache.title");
    screen.getByTestId("cluster-cache-section");
  });

  it("hides the KV cache tab when the deployment has no cache provider", () => {
    systemCapabilities.cacheProviders = [];
    showCluster();

    render(<ClustersShow />);

    expect(screen.queryByText("clusters.cache.title")).toBeNull();
    expect(screen.queryByTestId("cluster-cache-section")).toBeNull();
  });
});
