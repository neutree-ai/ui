import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useShowMock } = vi.hoisted(() => ({
  useShowMock: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useShow: useShowMock,
  useTranslation: () => ({ translate: (key: string) => key }),
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

vi.mock("@/domains/cluster/components/ClusterResourceSummary", () => ({
  ClusterResourceSummary: ({ resourceInfo }: { resourceInfo: unknown }) => (
    <div data-testid="cluster-resource-summary">
      {JSON.stringify(resourceInfo)}
    </div>
  ),
}));

vi.mock("@/domains/cluster/components/NodeResourcesTable", () => ({
  NodeResourcesTable: ({
    nodeResources,
    acceleratorTypes,
    framed,
  }: {
    nodeResources: Record<string, unknown>;
    acceleratorTypes: string[];
    framed: boolean;
  }) => (
    <div data-testid="node-resources-table">
      {Object.keys(nodeResources).join(",")}|{acceleratorTypes.join(",")}|
      {String(framed)}
    </div>
  ),
}));

vi.mock("@/foundation/components/ResourceUsageLegend", () => ({
  ResourceUsageLegend: ({ items }: { items: Array<{ label: string }> }) => (
    <div data-testid="resource-usage-legend">
      {items.map((item) => item.label).join(",")}
    </div>
  ),
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
    <div>{children}</div>
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
  useSystemApi: () => ({ grafanaUrl: null }),
}));

import { ClustersShow } from "./show";

describe("ClustersShow", () => {
  beforeEach(() => {
    useShowMock.mockReset();
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
    expect(screen.getByText("clusters.messages.notFound")).toBeTruthy();
  });

  it("connects cluster and node resource data to the redesigned sections", () => {
    useShowMock.mockReturnValue({
      query: {
        isLoading: false,
        data: {
          data: {
            metadata: {
              name: "gpu-cluster",
              workspace: "design-lab",
              creation_timestamp: "2026-08-25T00:00:00Z",
            },
            spec: {
              type: "kubernetes",
              version: "v1.2.0",
              image_registry: "default",
              accelerator_virtualization: { enabled: true },
              config: {},
            },
            status: {
              phase: "Running",
              version: "v1.2.0",
              resource_info: {
                allocatable: {
                  cpu: 16,
                  memory: 64,
                  accelerator_groups: {
                    nvidia_gpu: {
                      quantity: 1,
                      product_groups: { "Tesla-T4": 1 },
                    },
                  },
                },
                available: null,
                node_resources: {
                  "node-a": {
                    allocatable: null,
                    available: null,
                    devices: [],
                  },
                },
              },
            },
          },
        },
      },
    });

    render(<ClustersShow />);

    expect(
      screen.getByRole("heading", { level: 1, name: "gpu-cluster" }),
    ).toBeTruthy();
    expect(
      screen.getByTestId("cluster-resource-summary").textContent,
    ).toContain('"cpu":16');
    expect(screen.getByTestId("resource-usage-legend").textContent).toBe(
      "clusters.fields.vramUsed,clusters.fields.coreUsed",
    );
    expect(screen.getByTestId("node-resources-table").textContent).toBe(
      "node-a|nvidia_gpu|false",
    );
  });
});
