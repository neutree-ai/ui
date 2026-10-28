import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import {
  makeGpuDevice,
  makeResourceInfo,
} from "@/foundation/testing/resource-builders";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";
import { EndpointClusterGpuResourcesPanel } from "./EndpointClusterGpuResourcesPanel";

type PanelRequest = NonNullable<
  ComponentProps<typeof EndpointClusterGpuResourcesPanel>["request"]
>;

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
  "clusters.fields.coreUsage": "Core Usage",
  "clusters.fields.deviceUuid": "Device UUID",
  "clusters.fields.gpuNumber": "GPU",
  "clusters.fields.gpuType": "GPU Type",
  "clusters.fields.memoryUsage": "Memory Usage",
  "clusters.actions.copyUuid": "Copy UUID",
  "clusters.messages.copyUuidFailed": "Failed to copy GPU UUID",
  "clusters.messages.copyUuidSuccess": "GPU UUID copied",
  "clusters.options.allocated": "Allocated",
  "clusters.options.allGpuProducts": "All GPU Products",
  "clusters.options.free": "Free",
  "clusters.options.total": "Total",
  "clusters.options.unhealthy": "Unhealthy",
  "clusters.options.usable": "Usable",
  "clusters.options.used": "Used",
  "endpoints.fields.physicalGpu": "Card Count",
  "endpoints.sections.clusterDeviceResources": "Cluster Resources",
};

const t = (key: string) => translations[key] ?? key;

// The panel's device cards hang a tooltip off each product badge. The app
// mounts one TooltipProvider in its layout, so the panel only ever renders
// inside one; these tests render it in isolation and stand one in.
const renderPanel = (ui: ReactElement) =>
  render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);

const findByExactLabel = (cards: HTMLElement[], label: string) => {
  const card = cards.find((item) => within(item).queryByText(label));

  expect(card).toBeTruthy();

  return card as HTMLElement;
};

const getUsableCount = (count: number) =>
  screen.getByText((_, node) => node?.textContent === `Usable ${count}`);

const makeRequest = (overrides: Partial<PanelRequest>): PanelRequest => ({
  allocationMode: "full",
  cpuPerReplica: 1,
  memoryPerReplica: 1,
  requestedFullGpuCards: 0,
  fullGpuCardCapacity: 0,
  fullGpuCapacityExceeded: false,
  requestedVirtualCards: 0,
  totalVirtualCardCapacity: 0,
  requestedVgpuMemoryMiB: 0,
  availableVgpuMemoryMiB: 0,
  requestedVgpuCoreUnits: 0,
  availableVgpuCoreUnits: 0,
  vgpuCapacityExceeded: false,
  ...overrides,
});

const resourceInfo: ClusterResourceInfo = {
  allocatable: makeResourceInfo(64, 256, { "Tesla-T4": { quantity: 2 } }),
  available: makeResourceInfo(48, 192, { "Tesla-T4": { quantity: 1.5 } }),
  node_resources: {
    "node-a": {
      allocatable: makeResourceInfo(32, 128),
      available: makeResourceInfo(24, 96),
      devices: [
        makeGpuDevice("GPU-free"),
        makeGpuDevice("GPU-partial", { memory_mib: 7680, core_units: 50 }),
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

const panelDefaults = {
  resourceInfo,
  currentCluster: "cluster-a",
  selectedAccelerator: { type: "nvidia_gpu", product: "Tesla-T4" },
  t,
};

describe("EndpointClusterGpuResourcesPanel", () => {
  beforeEach(() => {
    vi.mocked(useIsTruncated).mockReturnValue(false);
  });

  it("shows node GPU device cards when virtualization is disabled but devices exist", () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        {...panelDefaults}
        virtualizationEnabled={false}
      />,
    );

    screen.getByTestId("endpoint-node-gpu-card-grid");
    const clusterSummary = within(
      screen.getByTestId("endpoint-cluster-resource-summary"),
    );
    clusterSummary.getByText("Memory Usage");
    clusterSummary.getByText("Core Usage");
    screen.getByRole("button", { name: "GPU 1 Copy UUID" });
    screen.getByRole("button", { name: "GPU 2 Copy UUID" });
    getUsableCount(1);
  });

  it("uses aggregate capacity in the summary and fully free devices in cards", () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        {...panelDefaults}
        virtualizationEnabled={true}
      />,
    );

    const summaryCards = screen.getAllByTestId(
      "endpoint-resource-summary-card",
    );
    const cardCountCard = findByExactLabel(summaryCards, "Card Count");
    within(cardCountCard).getByText("Free 1.5");
    getUsableCount(1);
    expect(screen.getAllByLabelText("Usable")).toHaveLength(1);
    expect(screen.getAllByLabelText("Allocated")).toHaveLength(1);
  });

  it("keeps healthy GPU indicators native and out of the tab order", () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        {...panelDefaults}
        virtualizationEnabled={false}
      />,
    );

    const healthyIndicator = screen.getByRole("img", { name: "Usable" });
    expect(healthyIndicator.getAttribute("title")).toBe("Usable");
    expect(healthyIndicator.getAttribute("tabindex")).toBeNull();

    fireEvent.focus(healthyIndicator);

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows an unhealthy GPU device tooltip", async () => {
    const nodeA = resourceInfo.node_resources?.["node-a"];
    if (!nodeA) throw new Error("node fixture is incomplete");

    renderPanel(
      <EndpointClusterGpuResourcesPanel
        {...panelDefaults}
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
        virtualizationEnabled={false}
      />,
    );

    const unhealthyIndicator = screen.getByRole("img", {
      name: "Unhealthy",
    });
    expect(unhealthyIndicator.getAttribute("title")).toBeNull();
    expect(unhealthyIndicator.getAttribute("tabindex")).toBe("0");

    fireEvent.focus(unhealthyIndicator);

    expect((await screen.findByRole("tooltip")).textContent).toBe("Unhealthy");
  });

  it("uses fractional card capacity when checking physical GPU requests", () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        {...panelDefaults}
        virtualizationEnabled={false}
        request={makeRequest({
          allocationMode: "fractional",
          gpuPerReplica: 0.75,
          requestedFullGpuCards: 0.75,
          fullGpuCardCapacity: 1,
        })}
      />,
    );

    getUsableCount(1);
    expect(screen.getAllByLabelText("Usable")).toHaveLength(1);
    expect(screen.getAllByLabelText("Allocated")).toHaveLength(1);
  });

  it("uses core units instead of VRAM for fractional card usability", () => {
    const nodeA = resourceInfo.node_resources?.["node-a"];
    if (!nodeA) throw new Error("node fixture is incomplete");

    renderPanel(
      <EndpointClusterGpuResourcesPanel
        {...panelDefaults}
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
        virtualizationEnabled={false}
        request={makeRequest({
          allocationMode: "fractional",
          gpuPerReplica: 0.75,
          requestedFullGpuCards: 0.75,
          fullGpuCardCapacity: 2,
        })}
      />,
    );

    getUsableCount(2);
    expect(screen.getAllByLabelText("Usable")).toHaveLength(2);
  });

  it("marks GPU devices unusable when the same node cannot fit the request", () => {
    const nodeA = resourceInfo.node_resources?.["node-a"];
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        {...panelDefaults}
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
        virtualizationEnabled={true}
        request={makeRequest({
          allocationMode: "vgpu",
          cpuPerReplica: 2,
          memoryPerReplica: 8,
          requestedVirtualCards: 1,
          totalVirtualCardCapacity: 1,
          requestedVgpuMemoryMiB: 4096,
          availableVgpuMemoryMiB: 15360,
          requestedVgpuCoreUnits: 50,
          availableVgpuCoreUnits: 100,
          memoryMiBPerCard: 4096,
          coreUnitsPerCard: 50,
        })}
      />,
    );

    getUsableCount(0);
    expect(screen.getAllByLabelText("Allocated")).toHaveLength(2);
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
        {...panelDefaults}
        schedulingNodeResources={schedulingNodeResources}
        virtualizationEnabled={true}
        request={makeRequest({
          gpuPerReplica: 1,
          requestedFullGpuCards: 1,
          fullGpuCardCapacity: 2,
        })}
      />,
    );

    const nodeMetrics = screen.getAllByTestId("endpoint-node-resource-pill");
    const memoryCard = findByExactLabel(nodeMetrics, "Memory Usage");
    expect(
      within(memoryCard)
        .getAllByTestId("endpoint-node-resource-pill-value")
        .map((value) => value.textContent),
    ).toEqual(["30.0", "7.5", "22.5"]);
    getUsableCount(2);
    expect(screen.getAllByLabelText("Usable")).toHaveLength(2);
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
        {...panelDefaults}
        schedulingNodeResources={schedulingNodeResources}
        virtualizationEnabled={false}
        request={makeRequest({
          allocationMode: "fractional",
          gpuPerReplica: 0.75,
          requestedFullGpuCards: 0.75,
          fullGpuCardCapacity: 2,
        })}
      />,
    );

    getUsableCount(2);
    expect(screen.getAllByLabelText("Usable")).toHaveLength(2);
  });

  it("falls back to compact node summaries when devices are missing", () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        {...panelDefaults}
        resourceInfo={{
          ...resourceInfo,
          node_resources: {
            "node-a": {
              allocatable: makeResourceInfo(32, 128, {
                "Tesla-T4": { quantity: 2 },
              }),
              available: makeResourceInfo(24, 96, {
                "Tesla-T4": { quantity: 1 },
              }),
            },
          },
        }}
        virtualizationEnabled={true}
      />,
    );

    expect(screen.queryByTestId("endpoint-node-gpu-card-grid")).toBeNull();
    const compactResources = within(
      screen.getByTestId("endpoint-compact-node-resources"),
    );
    compactResources.getByText("Card Count");
  });

  it("shows resource units in card titles instead of appending them to every value", () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        {...panelDefaults}
        virtualizationEnabled={true}
      />,
    );

    const nodeCards = screen.getAllByTestId("endpoint-node-resource-pill");
    const cpuCard = findByExactLabel(nodeCards, "CPU");
    const memoryCard = findByExactLabel(nodeCards, "Memory");
    const summaryCards = screen.getAllByTestId(
      "endpoint-resource-summary-card",
    );
    const cardCountCard = findByExactLabel(summaryCards, "Card Count");
    const vramCard = findByExactLabel(summaryCards, "Memory Usage");
    const coreCard = findByExactLabel(summaryCards, "Core Usage");

    within(cpuCard).getByText("cores");
    within(memoryCard).getByText("GiB");
    within(vramCard).getByText("GiB");
    expect(within(cardCountCard).queryByText("cores")).toBeNull();
    expect(within(cardCountCard).queryByText("GiB")).toBeNull();
    expect(within(coreCard).queryByText("cores")).toBeNull();
    expect(within(coreCard).queryByText("GiB")).toBeNull();

    expect(within(cpuCard).queryByText("32.0 cores")).toBeNull();
    expect(within(memoryCard).queryByText("128.0 GiB")).toBeNull();
    within(cpuCard).getByText("32.0");
    within(memoryCard).getByText("128.0");
    expect(vramCard.textContent).not.toContain("7.5 / 30.0 GiB");
    within(vramCard).getByText((text) => text.includes("7.5 / 30.0"));
    expect(coreCard.textContent).not.toContain("cores");
    expect(coreCard.textContent).not.toContain("GiB");
    within(coreCard).getByText((text) => text.includes("50.0 / 200.0"));
  });

  it("shows a long GPU product name in full on the device card", async () => {
    const longProduct = "NVIDIA_RTX_5000_Ada_Generation_Server_Edition";
    vi.mocked(useIsTruncated).mockReturnValue(true);

    renderPanel(
      <EndpointClusterGpuResourcesPanel
        {...panelDefaults}
        resourceInfo={withProduct(resourceInfo, longProduct)}
        selectedAccelerator={{ type: "nvidia_gpu", product: longProduct }}
        virtualizationEnabled={false}
      />,
    );

    const [card] = screen.getAllByTestId("endpoint-gpu-device-card");
    const badge = within(card).getByText(longProduct)
      .parentElement as HTMLElement;

    // Truncated, so the tooltip is the only way to the whole name: the badge
    // has to be a keyboard stop, not a native title.
    expect(badge.getAttribute("title")).toBeNull();
    expect(badge.getAttribute("tabindex")).toBe("0");

    fireEvent.focus(badge);

    expect((await screen.findByRole("tooltip")).textContent).toBe(longProduct);
  });

  it("leaves a product name that fits alone", async () => {
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        {...panelDefaults}
        virtualizationEnabled={false}
      />,
    );

    const [card] = screen.getAllByTestId("endpoint-gpu-device-card");
    const productBadge = within(card).getByText("Tesla-T4");
    const badge = productBadge.parentElement as HTMLElement;

    // Nothing to reveal: no tab stop and no tooltip repeating the line.
    expect(badge.getAttribute("tabindex")).toBeNull();

    fireEvent.focus(badge);
    fireEvent.mouseEnter(badge);

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows the cluster's reported GPU products in the header badge, not the preset product", () => {
    // A catalog/recipe preset can carry a product (e.g. "L4") the cluster does
    // not have; the "GPU Type" badge must reflect the cluster's actual GPUs.
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        {...panelDefaults}
        selectedAccelerator={{ type: "nvidia_gpu", product: "L4" }}
        virtualizationEnabled={true}
      />,
    );

    const toolbar = within(
      screen.getByTestId("endpoint-cluster-resource-target-notes"),
    );
    toolbar.getByText("Tesla-T4");
    expect(toolbar.queryByText("L4")).toBeNull();
  });

  it("keeps cluster pool values visible when the preset accelerator matches no product", () => {
    // A recipe/catalog preset can carry a product name the cluster does not
    // report at all; the summary must fall back to the full pool instead of
    // rendering an all-dashes board.
    renderPanel(
      <EndpointClusterGpuResourcesPanel
        {...panelDefaults}
        selectedAccelerator={{ type: "nvidia_gpu", product: "H100" }}
        virtualizationEnabled={true}
      />,
    );

    const summaryCards = screen.getAllByTestId(
      "endpoint-resource-summary-card",
    );
    const cardCountCard = findByExactLabel(summaryCards, "Card Count");
    const vramCard = findByExactLabel(summaryCards, "Memory Usage");

    expect(cardCountCard.textContent).toContain("Used 0.5 / 2.0");
    expect(cardCountCard.textContent).toContain("Free 1.5");
    expect(cardCountCard.textContent).not.toContain("Used -");
    expect(vramCard.textContent).toContain("Used 7.5 / 30.0");
    expect(vramCard.textContent).not.toContain("Used -");
  });
});
