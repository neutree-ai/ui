import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  FULL_T4,
  makeGpuDevice,
  makeNodeResources,
  makeResourceInfo,
} from "@/foundation/testing/resource-builders";
import type {
  ClusterResourceInfo,
  DeviceResource,
  NodeResourceStatus,
} from "@/foundation/types/resource-types";
import { makeResourceRequest } from "../testing/builders";
import { EndpointClusterGpuResourcesPanel } from "./EndpointClusterGpuResourcesPanel";

vi.mock("@/foundation/hooks/use-copy-to-clipboard", () => ({
  useCopyToClipboard: () => ({ copy: vi.fn(), copied: false }),
}));

const HALF_T4 = { memory_mib: 7680, core_units: 50 };
const T4 = { type: "nvidia_gpu", product: "Tesla-T4" };

const node = (
  devices: DeviceResource[],
  available = makeResourceInfo(24, 96),
) =>
  makeNodeResources({
    allocatable: makeResourceInfo(32, 128),
    available,
    devices,
  });

// One free and one half-used Tesla-T4 on node-a, unless `nodes` says otherwise.
const cluster = (
  nodes: Record<string, NodeResourceStatus> = {
    "node-a": node([
      makeGpuDevice("GPU-free"),
      makeGpuDevice("GPU-partial", HALF_T4),
    ]),
  },
): ClusterResourceInfo => ({
  allocatable: makeResourceInfo(64, 256, { "Tesla-T4": { quantity: 2 } }),
  available: makeResourceInfo(48, 192, { "Tesla-T4": { quantity: 1.5 } }),
  node_resources: nodes,
});

type PanelProps = ComponentProps<typeof EndpointClusterGpuResourcesPanel>;

// The panel takes the caller's translator: hand it the global key-returning one.
function Panel(props: Omit<PanelProps, "t">) {
  const { t } = useTranslation();
  return <EndpointClusterGpuResourcesPanel t={t} {...props} />;
}

// The device cards hang tooltips off product names; the app supplies the
// TooltipProvider from its layout.
const renderPanel = (props: Partial<Omit<PanelProps, "t">> = {}) =>
  render(
    <TooltipProvider delayDuration={0}>
      <Panel
        resourceInfo={cluster()}
        currentCluster="cluster-a"
        selectedAccelerator={T4}
        virtualizationEnabled={false}
        {...props}
      />
    </TooltipProvider>,
  );

const openClusterDetails = () =>
  fireEvent.click(screen.getByTestId("endpoint-cluster-details-toggle"));

const deviceCard = (gpuNumber: number) => {
  const card = screen
    .getAllByTestId("endpoint-gpu-device-card")
    .find((item) =>
      within(item).queryByText(`clusters.fields.gpuNumber ${gpuNumber}`),
    );
  if (!card) throw new Error(`no card for GPU ${gpuNumber}`);
  return within(card);
};

const usableBadge = (count: number) =>
  screen.getByText(
    (_, element) =>
      element?.textContent === `clusters.options.usableForRequest ${count}`,
  );

describe("EndpointClusterGpuResourcesPanel", () => {
  it("asks for a cluster before showing cluster resources", () => {
    renderPanel({ resourceInfo: null, currentCluster: null });

    screen.getByText("endpoints.placeholders.clusterResourcesRequiresCluster");
  });

  it("shows node GPU device cards when virtualization is disabled but devices exist", () => {
    renderPanel({ nodeCount: 2 });

    screen.getByTestId("endpoint-node-gpu-card-grid");
    screen.getByRole("button", {
      name: "clusters.fields.gpuNumber 1 clusters.actions.copyUuid",
    });
    screen.getByRole("button", {
      name: "clusters.fields.gpuNumber 2 clusters.actions.copyUuid",
    });
    usableBadge(1);
    screen.getByText("endpoints.messages.selectedAcceleratorResources");
  });

  it("opens and closes cluster capacity from the toolbar control", () => {
    renderPanel({ nodeCount: 2 });

    const trigger = screen.getByTestId("endpoint-cluster-details-toggle");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.textContent).toBe("endpoints.actions.showDetails");
    expect(
      screen.queryByTestId("endpoint-cluster-resource-summary"),
    ).toBeNull();

    openClusterDetails();

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("endpoint-cluster-node-count").textContent).toBe(
      "endpoints.clusterDetails.nodeCount:2 · clusters.gpuInventory.count:2",
    );
    const summary = within(
      screen.getByTestId("endpoint-cluster-resource-summary"),
    );
    for (const label of [
      "clusters.fields.memoryUsage",
      "clusters.fields.coreUsage",
      "common.fields.cpu",
      "common.fields.memory",
    ]) {
      summary.getByRole("group", { name: label });
    }
    expect(summary.queryByText("clusters.options.allocated")).toBeNull();
    expect(trigger.textContent).toBe("endpoints.actions.hideDetails");

    openClusterDetails();

    expect(
      screen.queryByTestId("endpoint-cluster-resource-summary"),
    ).toBeNull();
  });

  it("keeps the GPU total empty when the cluster reports no accelerator pool", () => {
    renderPanel({
      resourceInfo: {
        ...cluster(),
        allocatable: makeResourceInfo(64, 256),
        available: makeResourceInfo(48, 192),
      },
      nodeCount: 2,
      selectedAccelerator: null,
    });

    openClusterDetails();

    expect(screen.getByTestId("endpoint-cluster-node-count").textContent).toBe(
      "endpoints.clusterDetails.nodeCount:2 · -",
    );
  });

  it("does not claim accelerator filtering when the selected product is absent", () => {
    renderPanel({
      selectedAccelerator: { type: "nvidia_gpu", product: "Missing-GPU" },
    });

    expect(
      screen.queryByText("endpoints.messages.selectedAcceleratorResources"),
    ).toBeNull();
  });

  it("opens matching GPU details for dense nodes", () => {
    const devices = Array.from({ length: 8 }, (_, index) =>
      makeGpuDevice(`GPU-${index}`),
    );
    renderPanel({ resourceInfo: cluster({ "node-a": node(devices) }) });

    expect(screen.getAllByTestId("endpoint-gpu-device-card")).toHaveLength(8);
    expect(
      screen
        .getByRole("button", { name: "clusters.fields.gpuDetails (8)" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("labels each device card with its status", () => {
    renderPanel({
      resourceInfo: cluster({
        "node-a": node([
          makeGpuDevice("a-free"),
          makeGpuDevice("b-partial", HALF_T4),
          makeGpuDevice("c-sick", FULL_T4, { health: false }),
        ]),
      }),
    });

    deviceCard(1).getByText("clusters.options.usableForRequest");
    deviceCard(2).getByText("clusters.options.allocated");
    deviceCard(3).getByText("clusters.options.unhealthy");
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("keeps the Allocated label on a partly used card that fits the request", () => {
    renderPanel({
      resourceInfo: cluster({
        "node-a": node([
          makeGpuDevice("GPU-free"),
          makeGpuDevice("GPU-partial", { memory_mib: 1, core_units: 75 }),
        ]),
      }),
      request: makeResourceRequest("fractional", { gpuPerReplica: 0.75 }),
    });

    usableBadge(2);
    deviceCard(2).getByText("clusters.options.allocated");
  });

  it("shows original resources while judging usability on the scheduling view", () => {
    renderPanel({
      schedulingNodeResources: {
        "node-a": node([
          makeGpuDevice("GPU-free"),
          makeGpuDevice("GPU-partial"),
        ]),
      },
      virtualizationEnabled: true,
      request: makeResourceRequest("full", { gpuPerReplica: 1 }),
    });

    const vram = within(
      within(screen.getByTestId("endpoint-node-resource-metrics")).getByRole(
        "group",
        { name: "clusters.fields.memoryUsage" },
      ),
    );
    vram.getByText("7.5");
    vram.getByText("30.0 clusters.options.total");
    vram.getByText("22.5");
    usableBadge(2);
  });

  it("falls back to compact node summaries when devices are missing", () => {
    renderPanel({
      resourceInfo: cluster({
        "node-a": makeNodeResources({
          allocatable: makeResourceInfo(32, 128, {
            "Tesla-T4": { quantity: 2 },
          }),
          available: makeResourceInfo(24, 96, { "Tesla-T4": { quantity: 1 } }),
        }),
      }),
      virtualizationEnabled: true,
    });

    expect(screen.queryByTestId("endpoint-node-gpu-card-grid")).toBeNull();
    within(screen.getByTestId("endpoint-compact-node-resources")).getByRole(
      "group",
      { name: "endpoints.fields.physicalGpu" },
    );
  });

  it("shows a summary reading's percentage in its bar tooltip", async () => {
    renderPanel();

    openClusterDetails();
    const memory = within(
      within(screen.getByTestId("endpoint-cluster-resource-summary")).getByRole(
        "group",
        { name: "common.fields.memory" },
      ),
    );
    memory.getByText("256.0 clusters.options.total");
    memory.getByText("64.0");
    memory.getByText("192.0");
    expect(memory.queryByText("25.0%")).toBeNull();

    fireEvent.focus(
      memory.getByRole("progressbar", { name: "common.fields.memory: 25.0%" }),
    );

    expect((await screen.findByRole("tooltip")).textContent).toContain("25.0%");
  });

  it("shows a long GPU product name in full on the device card", async () => {
    const longProduct = "NVIDIA_RTX_5000_Ada_Generation_Server_Edition";
    vi.mocked(useIsTruncated).mockReturnValue(true);
    renderPanel({
      resourceInfo: cluster({
        "node-a": node([
          makeGpuDevice("GPU-0", FULL_T4, { product: longProduct }),
        ]),
      }),
      selectedAccelerator: { type: "nvidia_gpu", product: longProduct },
    });

    // Reachable on hover and keyboard focus; a native title would leave
    // keyboard users no way to read it.
    const label = deviceCard(1).getByText(longProduct);
    expect(label.getAttribute("title")).toBeNull();
    expect(label.getAttribute("tabindex")).toBe("0");
    fireEvent.focus(label);

    expect((await screen.findByRole("tooltip")).textContent).toBe(longProduct);
  });

  it("leaves a product name that fits alone", () => {
    renderPanel();

    const label = deviceCard(1).getByText("Tesla-T4");
    expect(label.getAttribute("tabindex")).toBeNull();
    fireEvent.focus(label);
    fireEvent.mouseEnter(label);

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("marks GPU cards that do not match the selected accelerator product", () => {
    const h100 = makeGpuDevice("GPU-h100-a", HALF_T4, { product: "H100" });
    const l40s = makeGpuDevice("GPU-l40s-b", FULL_T4, { product: "L40S" });
    renderPanel({
      resourceInfo: cluster({ "node-a": node([h100]), "node-b": node([l40s]) }),
      selectedAccelerator: { type: "nvidia_gpu", product: "H100" },
    });

    const [selectedNode, otherNode] = screen.getAllByTestId(
      "endpoint-compact-node-card",
    );
    within(selectedNode).getByText("clusters.options.allocated");
    expect(
      within(otherNode).queryByTestId("endpoint-node-gpu-card-grid"),
    ).toBeNull();

    fireEvent.click(
      within(otherNode).getByRole("button", {
        name: "clusters.fields.gpuDetails (1)",
      }),
    );

    within(otherNode).getByText("clusters.options.otherType");
  });

  it("keeps cluster pool values visible when the preset accelerator matches no product", () => {
    renderPanel({
      selectedAccelerator: { type: "nvidia_gpu", product: "H100" },
      virtualizationEnabled: true,
    });

    openClusterDetails();
    const vram = within(
      within(screen.getByTestId("endpoint-cluster-resource-summary")).getByRole(
        "group",
        { name: "clusters.fields.memoryUsage" },
      ),
    );
    vram.getByText("7.5");
    vram.getByText("30.0 clusters.options.total");
  });
});
