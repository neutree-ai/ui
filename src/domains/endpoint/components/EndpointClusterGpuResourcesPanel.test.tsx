import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";
import { EndpointClusterGpuResourcesPanel } from "./EndpointClusterGpuResourcesPanel";

vi.mock("@/foundation/hooks/use-copy-to-clipboard", () => ({
  useCopyToClipboard: () => ({
    copy: vi.fn(),
    copied: false,
  }),
}));

const translations: Record<string, string> = {
  "common.fields.cluster": "Cluster",
  "common.fields.cpu": "CPU",
  "common.fields.memory": "Memory",
  "clusters.fields.coreUsage": "Core",
  "clusters.fields.deviceUuid": "Device UUID",
  "clusters.fields.gpuNumber": "GPU",
  "clusters.fields.gpuDetails": "GPU details",
  "clusters.fields.gpuType": "GPU Type",
  "clusters.fields.memoryUsage": "Memory Usage",
  "clusters.gpuInventory.count": "{{count}} GPUs",
  "clusters.gpuInventory.count_one": "{{count}} GPU",
  "clusters.actions.copyUuid": "Copy UUID",
  "clusters.messages.copyUuidFailed": "Failed to copy GPU UUID",
  "clusters.messages.copyUuidSuccess": "GPU UUID copied",
  "clusters.options.allocated": "Allocated",
  "clusters.options.allGpuProducts": "All GPU Products",
  "clusters.options.free": "Free",
  "clusters.options.total": "Total",
  "clusters.options.unhealthy": "Unhealthy",
  "clusters.options.otherType": "Other accelerator",
  "clusters.options.usableForRequest": "Usable",
  "clusters.options.used": "Used",
  "endpoints.fields.physicalGpu": "Card Count",
  "endpoints.messages.selectedAcceleratorResources":
    "Showing resources available to the selected accelerator.",
  "endpoints.actions.showDetails": "Show details",
  "endpoints.actions.hideDetails": "Hide details",
  "endpoints.clusterDetails.nodeCount": "{{count}} Nodes",
  "endpoints.clusterDetails.nodeCount_one": "{{count}} Node",
  "endpoints.sections.clusterDeviceResources": "Cluster Resources",
};

const t = (key: string, options: Record<string, unknown> = {}) => {
  const pluralKey =
    options.count === 1 && translations[`${key}_one`] ? `${key}_one` : key;

  return Object.entries(options).reduce(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
    translations[pluralKey] ?? pluralKey,
  );
};

// The panel's device cards hang a tooltip off each product badge. The app
// mounts one TooltipProvider in its layout, so the panel only ever renders
// inside one; these tests render it in isolation and stand one in.
const renderPanel = (ui: ReactElement) =>
  render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);

const openClusterDetails = () =>
  fireEvent.click(screen.getByTestId("endpoint-cluster-details-toggle"));

const findByExactLabel = (cards: HTMLElement[], label: string) => {
  const card = cards.find((item) => within(item).queryByText(label));

  expect(card).toBeTruthy();

  return card as HTMLElement;
};

const resourceInfo: ClusterResourceInfo = {
  allocatable: {
    cpu: 64,
    memory: 256,
    accelerator_groups: {
      nvidia_gpu: {
        quantity: 2,
        product_groups: null,
        products: {
          "Tesla-T4": {
            quantity: 2,
          },
        },
      },
    },
  },
  available: {
    cpu: 48,
    memory: 192,
    accelerator_groups: {
      nvidia_gpu: {
        quantity: 1.5,
        product_groups: null,
        products: {
          "Tesla-T4": {
            quantity: 1.5,
          },
        },
      },
    },
  },
  node_resources: {
    "node-a": {
      allocatable: {
        cpu: 32,
        memory: 128,
        accelerator_groups: null,
      },
      available: {
        cpu: 24,
        memory: 96,
        accelerator_groups: null,
      },
      devices: [
        {
          uuid: "GPU-free",
          product: "Tesla-T4",
          health: true,
          allocatable: {
            memory_mib: 15360,
            core_units: 100,
          },
          available: {
            memory_mib: 15360,
            core_units: 100,
          },
        },
        {
          uuid: "GPU-partial",
          product: "Tesla-T4",
          health: true,
          allocatable: {
            memory_mib: 15360,
            core_units: 100,
          },
          available: {
            memory_mib: 7680,
            core_units: 50,
          },
        },
      ],
    },
  },
};

// Retags every device with `product`, leaving the rest of the fixture alone.
const withProduct = (
  info: ClusterResourceInfo,
  product: string,
): ClusterResourceInfo => ({
  ...info,
  node_resources: Object.fromEntries(
    Object.entries(info.node_resources ?? {}).map(([nodeName, node]) => [
      nodeName,
      { ...node, devices: node.devices?.map((d) => ({ ...d, product })) },
    ]),
  ),
});

describe("EndpointClusterGpuResourcesPanel", () => {
  beforeEach(() => {
    vi.mocked(useIsTruncated).mockReturnValue(false);
  });

  it("asks for a cluster before showing cluster resources", () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={null}
        currentCluster={null}
        virtualizationEnabled={false}
        t={t}
      />,
    );

    screen.getByText("endpoints.placeholders.clusterResourcesRequiresCluster");
  });

  it("shows node GPU device cards when virtualization is disabled but devices exist", () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        currentCluster="cluster-a"
        nodeCount={2}
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={false}
        t={t}
      />,
    );

    screen.getByTestId("endpoint-node-gpu-card-grid");
    expect(
      screen.getAllByTestId("endpoint-node-resource-progress").length,
    ).toBeGreaterThan(0);
    openClusterDetails();
    const clusterSummary = within(
      screen.getByTestId("endpoint-cluster-resource-summary"),
    );
    clusterSummary.getByText("Memory Usage");
    clusterSummary.getByText("Core");
    clusterSummary.getByText("Memory");
    screen.getByRole("button", {
      name: "GPU 1 Copy UUID",
    });
    screen.getByRole("button", {
      name: "GPU 2 Copy UUID",
    });
    screen.getByText((_, node) => node?.textContent === "Usable 1");
    expect(
      screen.getByTestId("endpoint-cluster-accelerator-scope-hint").textContent,
    ).toContain("Showing resources available to the selected accelerator.");
  });

  it("opens compact cluster capacity from the toolbar control", () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        currentCluster="cluster-a"
        nodeCount={2}
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={false}
        t={t}
      />,
    );

    const trigger = screen.getByTestId("endpoint-cluster-details-toggle");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.textContent).toContain("Show details");
    expect(
      screen.queryByTestId("endpoint-cluster-resource-metrics"),
    ).toBeNull();
    screen.getByTestId("endpoint-compact-node-resources");

    openClusterDetails();

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("endpoint-cluster-node-count").textContent).toBe(
      "2 Nodes · 2 GPUs",
    );
    screen.getByTestId("endpoint-cluster-resource-metrics");
    expect(
      screen.getAllByTestId("endpoint-resource-summary-progress"),
    ).toHaveLength(4);
    expect(trigger.textContent).toContain("Hide details");

    openClusterDetails();

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen.queryByTestId("endpoint-cluster-resource-metrics"),
    ).toBeNull();
  });

  it("uses singular node copy for a one-node cluster", () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        currentCluster="cluster-a"
        nodeCount={1}
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={false}
        t={t}
      />,
    );

    openClusterDetails();

    expect(screen.getByTestId("endpoint-cluster-node-count").textContent).toBe(
      "1 Node · 2 GPUs",
    );
  });

  it("keeps the GPU total empty when the cluster reports no accelerator pool", () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={{
          ...resourceInfo,
          allocatable: {
            ...resourceInfo.allocatable!,
            accelerator_groups: null,
          },
          available: {
            ...resourceInfo.available!,
            accelerator_groups: null,
          },
          accelerator_metadata: undefined,
        }}
        currentCluster="cluster-a"
        nodeCount={2}
        virtualizationEnabled={false}
        t={t}
      />,
    );

    openClusterDetails();

    expect(screen.getByTestId("endpoint-cluster-node-count").textContent).toBe(
      "2 Nodes · -",
    );
  });

  it("does not repeat GPU inventory already present in node cards", () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={false}
        t={t}
      />,
    );

    openClusterDetails();

    expect(screen.queryByText("All GPU cards")).toBeNull();
    expect(
      screen.queryByTestId("endpoint-cluster-gpu-inventory-details"),
    ).toBeNull();
    screen.getByTestId("endpoint-compact-node-resources");
  });

  it("does not claim accelerator filtering when the selected product is absent", () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Missing-GPU" }}
        virtualizationEnabled={false}
        t={t}
      />,
    );

    expect(
      screen.queryByTestId("endpoint-cluster-accelerator-scope-hint"),
    ).toBeNull();
  });

  it("leaves card usage out of the cluster summary", () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={true}
        t={t}
      />,
    );

    openClusterDetails();
    const summaryCards = screen.getAllByTestId(
      "endpoint-resource-summary-card",
    );
    expect(summaryCards).toHaveLength(4);
    expect(screen.queryByTestId("endpoint-cluster-card-usage")).toBeNull();
    screen.getByText((_, node) => node?.textContent === "Usable 1");
    const clusterSummary = within(
      screen.getByTestId("endpoint-cluster-resource-summary"),
    );
    expect(clusterSummary.queryByText("Usable")).toBeNull();
    expect(clusterSummary.queryByText("Allocated")).toBeNull();
    const availability = screen
      .getAllByTestId("endpoint-gpu-meter-row")
      .map((row) => row.getAttribute("data-availability"));
    expect(availability.filter((state) => state === "usable")).toHaveLength(2);
    expect(availability.filter((state) => state === "allocated")).toHaveLength(
      2,
    );
  });

  it("opens matching GPU details for dense nodes without hiding node capacity", () => {
    const nodeA = resourceInfo.node_resources?.["node-a"];
    const firstDevice = nodeA?.devices?.[0];
    if (!nodeA || !firstDevice) throw new Error("node fixture is incomplete");
    const devices = Array.from({ length: 8 }, (_, index) => ({
      ...firstDevice,
      uuid: `GPU-${index}`,
    }));

    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={{
          ...resourceInfo,
          node_resources: {
            "node-a": { ...nodeA, devices },
          },
        }}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={false}
        t={t}
      />,
    );

    screen.getByTestId("endpoint-node-resource-metrics");
    screen.getByTestId("endpoint-node-gpu-card-grid");
    expect(screen.getAllByTestId("endpoint-gpu-device-card")).toHaveLength(8);
    expect(
      screen
        .getByRole("button", { name: "GPU details (8)" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("shows a healthy GPU status as text without another focus target", () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={false}
        t={t}
      />,
    );

    screen.getByText("Usable");
    expect(screen.queryByRole("img", { name: "Usable" })).toBeNull();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows an unhealthy GPU status as text", () => {
    const nodeA = resourceInfo.node_resources?.["node-a"];
    if (!nodeA) throw new Error("node fixture is incomplete");

    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={{
          ...resourceInfo,
          node_resources: {
            "node-a": {
              ...nodeA,
              devices: nodeA.devices?.map((device) =>
                device.uuid === "GPU-free"
                  ? { ...device, health: false }
                  : device,
              ),
            },
          },
        }}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={false}
        t={t}
      />,
    );

    screen.getByText("Unhealthy");
    expect(screen.queryByRole("img", { name: "Unhealthy" })).toBeNull();
    expect(
      screen
        .getAllByTestId("endpoint-gpu-meter-row")
        .filter((row) => row.getAttribute("data-availability") === "unhealthy"),
    ).toHaveLength(2);
  });

  it("uses fractional card capacity when checking physical GPU requests", () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={false}
        request={{
          allocationMode: "fractional",
          gpuPerReplica: 0.75,
          cpuPerReplica: 1,
          memoryPerReplica: 1,
          requestedFullGpuCards: 0.75,
          fullGpuCardCapacity: 1,
          fullGpuCapacityExceeded: false,
          requestedVirtualCards: 0,
          totalVirtualCardCapacity: 0,
          requestedVgpuMemoryMiB: 0,
          availableVgpuMemoryMiB: 0,
          requestedVgpuCoreUnits: 0,
          availableVgpuCoreUnits: 0,
          vgpuCapacityExceeded: false,
        }}
        t={t}
      />,
    );

    screen.getByText((_, node) => node?.textContent === "Usable 1");
    expect(screen.getAllByText("Usable")).toHaveLength(1);
    expect(screen.getAllByText("Allocated")).toHaveLength(1);
    const partialCard = findByExactLabel(
      screen.getAllByTestId("endpoint-gpu-device-card"),
      "GPU 2",
    );
    within(partialCard).getByText("Allocated");
    expect(within(partialCard).queryByText("Usable")).toBeNull();
  });

  it("uses core units instead of VRAM for fractional card usability", () => {
    const nodeA = resourceInfo.node_resources?.["node-a"];
    if (!nodeA) throw new Error("node fixture is incomplete");

    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={{
          ...resourceInfo,
          node_resources: {
            "node-a": {
              ...nodeA,
              devices: nodeA.devices?.map((device) =>
                device.uuid === "GPU-partial"
                  ? {
                      ...device,
                      available: { memory_mib: 1, core_units: 75 },
                    }
                  : device,
              ),
            },
          },
        }}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={false}
        request={{
          allocationMode: "fractional",
          gpuPerReplica: 0.75,
          cpuPerReplica: 1,
          memoryPerReplica: 1,
          requestedFullGpuCards: 0.75,
          fullGpuCardCapacity: 2,
          fullGpuCapacityExceeded: false,
          requestedVirtualCards: 0,
          totalVirtualCardCapacity: 0,
          requestedVgpuMemoryMiB: 0,
          availableVgpuMemoryMiB: 0,
          requestedVgpuCoreUnits: 0,
          availableVgpuCoreUnits: 0,
          vgpuCapacityExceeded: false,
        }}
        t={t}
      />,
    );

    screen.getByText((_, node) => node?.textContent === "Usable 2");
    expect(screen.getAllByText("Usable")).toHaveLength(1);
    const partialCard = findByExactLabel(
      screen.getAllByTestId("endpoint-gpu-device-card"),
      "GPU 2",
    );
    within(partialCard).getByText("Allocated");
    expect(
      within(partialCard)
        .getAllByTestId("endpoint-gpu-meter-row")
        .map((row) => row.getAttribute("data-availability")),
    ).toEqual(["usable", "usable"]);
  });

  it("marks GPU devices unusable when the same node cannot fit the request", () => {
    const nodeA = resourceInfo.node_resources?.["node-a"];
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={{
          ...resourceInfo,
          node_resources: {
            "node-a": {
              allocatable: nodeA?.allocatable ?? null,
              available: {
                accelerator_groups:
                  nodeA?.available?.accelerator_groups ?? null,
                cpu: 1,
                memory: 4,
              },
              devices: nodeA?.devices ?? [],
            },
          },
        }}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={true}
        request={{
          allocationMode: "vgpu",
          cpuPerReplica: 2,
          memoryPerReplica: 8,
          requestedFullGpuCards: 0,
          fullGpuCardCapacity: 0,
          fullGpuCapacityExceeded: false,
          requestedVirtualCards: 1,
          totalVirtualCardCapacity: 1,
          requestedVgpuMemoryMiB: 4096,
          availableVgpuMemoryMiB: 15360,
          requestedVgpuCoreUnits: 50,
          availableVgpuCoreUnits: 100,
          memoryMiBPerCard: 4096,
          coreUnitsPerCard: 50,
          vgpuCapacityExceeded: false,
        }}
        t={t}
      />,
    );

    screen.getByText((_, node) => node?.textContent === "Usable 0");
    expect(screen.getAllByText("Allocated")).toHaveLength(2);
  });

  it("shows original resources while using restored resources for edit scheduling", () => {
    const rawNode = resourceInfo.node_resources?.["node-a"];
    if (!rawNode?.available) throw new Error("node fixture is incomplete");

    const schedulingNodeResources = {
      "node-a": {
        ...rawNode,
        devices: rawNode.devices?.map((device) =>
          device.uuid === "GPU-partial"
            ? { ...device, available: device.allocatable }
            : device,
        ),
      },
    };

    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        schedulingNodeResources={schedulingNodeResources}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={true}
        request={{
          allocationMode: "full",
          gpuPerReplica: 1,
          cpuPerReplica: 1,
          memoryPerReplica: 1,
          requestedFullGpuCards: 1,
          fullGpuCardCapacity: 2,
          fullGpuCapacityExceeded: false,
          requestedVirtualCards: 0,
          totalVirtualCardCapacity: 0,
          requestedVgpuMemoryMiB: 0,
          availableVgpuMemoryMiB: 0,
          requestedVgpuCoreUnits: 0,
          availableVgpuCoreUnits: 0,
          vgpuCapacityExceeded: false,
        }}
        t={t}
      />,
    );

    const nodeMetrics = screen.getAllByTestId("endpoint-node-resource-pill");
    const memoryCard = findByExactLabel(nodeMetrics, "Memory Usage");
    expect(
      within(memoryCard).getByTestId("endpoint-node-resource-pill-used-value")
        .textContent,
    ).toBe("7.5");
    expect(
      within(memoryCard).getByTestId("endpoint-node-resource-pill-total-value")
        .textContent,
    ).toBe("30.0 total");
    expect(
      within(memoryCard).getByTestId("endpoint-node-resource-pill-free-value")
        .textContent,
    ).toBe("22.5");
    screen.getByText((_, node) => node?.textContent === "Usable 2");
    expect(screen.getAllByText("Usable")).toHaveLength(1);
  });

  it("uses restored device capacity for fractional edit scheduling", () => {
    const rawNode = resourceInfo.node_resources?.["node-a"];
    if (!rawNode?.available) throw new Error("node fixture is incomplete");

    const schedulingNodeResources = {
      "node-a": {
        ...rawNode,
        devices: rawNode.devices?.map((device) =>
          device.uuid === "GPU-partial"
            ? { ...device, available: device.allocatable }
            : device,
        ),
      },
    };

    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        schedulingNodeResources={schedulingNodeResources}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={false}
        request={{
          allocationMode: "fractional",
          gpuPerReplica: 0.75,
          cpuPerReplica: 1,
          memoryPerReplica: 1,
          requestedFullGpuCards: 0.75,
          fullGpuCardCapacity: 2,
          fullGpuCapacityExceeded: false,
          requestedVirtualCards: 0,
          totalVirtualCardCapacity: 0,
          requestedVgpuMemoryMiB: 0,
          availableVgpuMemoryMiB: 0,
          requestedVgpuCoreUnits: 0,
          availableVgpuCoreUnits: 0,
          vgpuCapacityExceeded: false,
        }}
        t={t}
      />,
    );

    screen.getByText((_, node) => node?.textContent === "Usable 2");
    expect(screen.getAllByText("Usable")).toHaveLength(1);
  });

  it("falls back to compact node summaries when devices are missing", () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={{
          ...resourceInfo,
          node_resources: {
            "node-a": {
              allocatable: {
                cpu: 32,
                memory: 128,
                accelerator_groups: {
                  nvidia_gpu: {
                    quantity: 2,
                    product_groups: null,
                    products: {
                      "Tesla-T4": {
                        quantity: 2,
                      },
                    },
                  },
                },
              },
              available: {
                cpu: 24,
                memory: 96,
                accelerator_groups: {
                  nvidia_gpu: {
                    quantity: 1,
                    product_groups: null,
                    products: {
                      "Tesla-T4": {
                        quantity: 1,
                      },
                    },
                  },
                },
              },
            },
          },
        }}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={true}
        t={t}
      />,
    );

    expect(screen.queryByTestId("endpoint-node-gpu-card-grid")).toBeNull();
    const compactResources = within(
      screen.getByTestId("endpoint-compact-node-resources"),
    );
    compactResources.getByText("Card Count");
  });

  it("shows system memory alongside core allocation in the cluster summary", async () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={false}
        t={t}
      />,
    );

    openClusterDetails();
    const summaryCards = screen.getAllByTestId(
      "endpoint-resource-summary-card",
    );
    const memoryCard = findByExactLabel(summaryCards, "Memory");

    expect(summaryCards).toHaveLength(4);
    screen.getByTestId("endpoint-cluster-resource-metrics");
    expect(
      within(memoryCard).getByTestId("endpoint-resource-summary-total-value")
        .textContent,
    ).toBe("256.0 total");
    expect(
      within(memoryCard).getByTestId("endpoint-resource-summary-used-value")
        .textContent,
    ).toBe("64.0");
    expect(
      within(memoryCard).getByTestId("endpoint-resource-summary-free-value")
        .textContent,
    ).toBe("192.0");

    expect(memoryCard.textContent).not.toContain("25.0%");
    fireEvent.focus(
      within(memoryCard).getByTestId("endpoint-resource-summary-progress"),
    );
    expect(
      (await screen.findByTestId("endpoint-resource-summary-percent"))
        .textContent,
    ).toContain("25.0%");
  });

  it("shows a long GPU product name in full on the device card", async () => {
    // The card is only ~180px wide, so a vendor-prefixed name used to be
    // clipped with no way to read the rest of it.
    const longProduct = "NVIDIA_RTX_5000_Ada_Generation_Server_Edition";
    vi.mocked(useIsTruncated).mockReturnValue(true);

    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={withProduct(resourceInfo, longProduct)}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: longProduct }}
        virtualizationEnabled={false}
        t={t}
      />,
    );

    const [card] = screen.getAllByTestId("endpoint-gpu-device-card");
    const productBadge = within(card).getByText(longProduct);

    // The full name survives the truncation, on hover and on keyboard focus:
    // a truncated label with no way back to its text is not readable, and a
    // native title would leave keyboard users with no way back at all.
    const label = productBadge;
    expect(label.getAttribute("title")).toBeNull();
    expect(label.getAttribute("tabindex")).toBe("0");
    fireEvent.focus(label);

    expect((await screen.findByRole("tooltip")).textContent).toBe(longProduct);
  });

  it("leaves a product name that fits alone", async () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={false}
        t={t}
      />,
    );

    const [card] = screen.getAllByTestId("endpoint-gpu-device-card");
    const productBadge = within(card).getByText("Tesla-T4");
    const label = productBadge;

    // Nothing to reveal, so nothing announces itself: no tab stop and no
    // tooltip repeating the line under the pointer.
    expect(label.getAttribute("tabindex")).toBeNull();

    fireEvent.focus(label);
    fireEvent.mouseEnter(label);

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("dims GPU cards that do not match the selected accelerator product", () => {
    const mixedGpuCluster: ClusterResourceInfo = {
      allocatable: {
        cpu: 64,
        memory: 256,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 3,
            product_groups: null,
            products: {
              H100: { quantity: 3 },
            },
          },
        },
      },
      available: {
        cpu: 48,
        memory: 192,
        accelerator_groups: {
          nvidia_gpu: {
            quantity: 2,
            product_groups: null,
            products: {
              H100: { quantity: 2 },
            },
          },
        },
      },
      node_resources: {
        "node-a": {
          allocatable: {
            cpu: 32,
            memory: 128,
            accelerator_groups: null,
          },
          available: {
            cpu: 24,
            memory: 96,
            accelerator_groups: null,
          },
          devices: [
            {
              uuid: "GPU-h100-a",
              product: "H100",
              health: true,
              allocatable: { memory_mib: 81920, core_units: 100 },
              available: { memory_mib: 40960, core_units: 50 },
            },
          ],
        },
        "node-b": {
          allocatable: {
            cpu: 32,
            memory: 128,
            accelerator_groups: null,
          },
          available: {
            cpu: 24,
            memory: 96,
            accelerator_groups: null,
          },
          devices: [
            {
              uuid: "GPU-l40s-b",
              product: "L40S",
              health: true,
              allocatable: { memory_mib: 49152, core_units: 100 },
              available: { memory_mib: 49152, core_units: 100 },
            },
          ],
        },
      },
    };

    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={mixedGpuCluster}
        currentCluster="mixed-gpu-cluster"
        selectedAccelerator={{ type: "nvidia_gpu", product: "H100" }}
        virtualizationEnabled={false}
        t={t}
      />,
    );

    const nodeCards = screen.getAllByTestId("endpoint-compact-node-card");
    const selectedNode = nodeCards.find((card) =>
      card.textContent?.includes("node-a"),
    );
    const otherTypeNode = nodeCards.find((card) =>
      card.textContent?.includes("node-b"),
    );
    if (!selectedNode || !otherTypeNode) {
      throw new Error("mixed node fixtures were not rendered");
    }

    const selectedCard = within(selectedNode).getByTestId(
      "endpoint-gpu-device-card",
    );
    expect(selectedCard?.getAttribute("data-product-match")).toBe("selected");
    expect(
      within(otherTypeNode).queryByTestId("endpoint-node-gpu-card-grid"),
    ).toBeNull();

    fireEvent.click(
      within(otherTypeNode).getByRole("button", {
        name: "GPU details (1)",
      }),
    );

    const otherTypeCard = within(otherTypeNode).getByTestId(
      "endpoint-gpu-device-card",
    );
    expect(otherTypeCard?.getAttribute("data-product-match")).toBe("other");
    otherTypeCard && within(otherTypeCard).getByText("Other accelerator");
    expect(
      screen.queryByTestId("endpoint-cluster-resource-target-notes"),
    ).toBeNull();
  });

  it("keeps cluster pool values visible when the preset accelerator matches no product", () => {
    // A recipe/catalog preset can carry a product name the cluster does not
    // report at all; the summary must fall back to the full pool instead of
    // rendering an all-dashes board.
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "H100" }}
        virtualizationEnabled={true}
        t={t}
      />,
    );

    openClusterDetails();
    const summaryCards = screen.getAllByTestId(
      "endpoint-resource-summary-card",
    );
    const vramCard = findByExactLabel(summaryCards, "Memory Usage");

    expect(vramCard.textContent).toContain("Used 7.5");
    expect(vramCard.textContent).toContain("30.0 total");
    expect(vramCard.textContent).not.toContain("Used -");
  });
});
