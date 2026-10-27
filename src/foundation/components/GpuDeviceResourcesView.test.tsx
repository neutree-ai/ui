import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import type { NodeResourceStatus } from "@/foundation/types/resource-types";
import { GpuDeviceResourcesView } from "./GpuDeviceResourcesView";

const copyMock = vi.fn();
vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: { value: number }) => (
    <div data-testid="progress" data-value={value} />
  ),
}));

vi.mock("@/foundation/hooks/use-copy-to-clipboard", () => ({
  useCopyToClipboard: () => ({
    copy: copyMock,
    copied: false,
  }),
}));

const labels = {
  title: "GPU Device Resources",
  deviceCount: "Devices",
  healthyDevices: "Healthy Devices",
  memoryUsage: "Memory Usage",
  coreUsage: "Core Usage",
  allProducts: "All Products",
  allNodes: "All Nodes",
  allDevices: "All Devices",
  searchPlaceholder: "Search devices",
  gpuNumber: "GPU",
  uuid: "GPU UUID",
  status: "Status",
  healthy: "Healthy",
  unhealthy: "Unhealthy",
  node: "Node",
  product: "Product",
  selected: "Selected",
  usable: "Usable",
  free: "Free",
  allocated: "Allocated",
  resourceScope: "Resource Scope",
  freeCards: "Free Cards",
  usableForRequest: "Usable For Request",
  copyUuid: "Copy UUID",
  copyUuidSuccess: "GPU UUID copied",
  copyUuidFailed: "Failed to copy GPU UUID",
  remaining: "Remaining",
  usedSlashTotal: "Used / Total",
  empty: "No GPU devices",
};

const nodeResources: Record<string, NodeResourceStatus> = {
  "node-a": {
    allocatable: {
      cpu: 16,
      memory: 64,
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
    available: {
      cpu: 12,
      memory: 48,
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
    devices: [
      {
        uuid: "GPU-11111111-2222-3333-4444-555555555555",
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
};

describe("GpuDeviceResourcesView", () => {
  beforeEach(() => {
    copyMock.mockClear();
    vi.mocked(useIsTruncated).mockReturnValue(false);
  });

  it("renders GPU number, copyable UUID, remaining pools, and no slots column", () => {
    render(
      <GpuDeviceResourcesView
        nodeResources={nodeResources}
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        labels={labels}
      />,
    );

    screen.getByText("GPU Device Resources");
    screen.getByText("GPU 1");
    expect(
      screen.getByText("GPU 1").closest("button")?.getAttribute("title"),
    ).toBe("Copy UUID");
    expect(
      screen.queryByTitle("GPU-11111111-2222-3333-4444-555555555555"),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "GPU 1 Copy UUID",
      }),
    );
    expect(copyMock).toHaveBeenCalledWith(
      "GPU-11111111-2222-3333-4444-555555555555",
      expect.any(Object),
    );
    screen.getByText("Tesla-T4");
    screen.getByText("Selected");
    expect(screen.queryByText("Healthy")).toBeNull();
    expect(screen.queryByText("Unhealthy")).toBeNull();
    expect(screen.getAllByText("7.5 / 15.0 GiB").length).toBeGreaterThan(0);
    expect(screen.getAllByText("50 / 100").length).toBeGreaterThan(0);
    expect(screen.getAllByText("7.5 GiB").length).toBeGreaterThan(0);
    expect(screen.getAllByText("50").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Remaining").length).toBeGreaterThan(0);
    expect(screen.queryByText(/slot/i)).toBeNull();
  });

  it("does not mark devices as selected when no accelerator is selected", () => {
    render(
      <GpuDeviceResourcesView nodeResources={nodeResources} labels={labels} />,
    );

    screen.getByText("Tesla-T4");
    expect(screen.queryByText("Selected")).toBeNull();
  });

  it("keeps healthy device indicators native and out of the tab order", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <GpuDeviceResourcesView nodeResources={nodeResources} labels={labels} />
      </TooltipProvider>,
    );

    const healthyIndicator = screen.getByRole("img", { name: "Healthy" });
    expect(healthyIndicator.getAttribute("title")).toBe("Healthy");
    expect(healthyIndicator.getAttribute("tabindex")).toBeNull();

    fireEvent.focus(healthyIndicator);

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows an unhealthy device tooltip in the cluster detail table", async () => {
    const nodeA = nodeResources["node-a"];
    if (!nodeA) throw new Error("node fixture is incomplete");

    render(
      <TooltipProvider delayDuration={0}>
        <GpuDeviceResourcesView
          nodeResources={{
            "node-a": {
              ...nodeA,
              devices: nodeA.devices?.map((device) => ({
                ...device,
                health: false,
              })),
            },
          }}
          labels={labels}
        />
      </TooltipProvider>,
    );

    const unhealthyIndicator = screen.getByRole("img", {
      name: "Unhealthy",
    });
    expect(unhealthyIndicator.getAttribute("title")).toBeNull();
    expect(unhealthyIndicator.getAttribute("tabindex")).toBe("0");

    fireEvent.focus(unhealthyIndicator);

    expect((await screen.findByRole("tooltip")).textContent).toBe("Unhealthy");
  });

  it("does not append a VRAM unit when summary remaining memory is unknown", () => {
    render(
      <GpuDeviceResourcesView
        nodeResources={{
          "node-a": {
            allocatable: null,
            available: null,
            devices: [
              {
                uuid: "GPU-unknown",
                product: "Tesla-T4",
                health: true,
                allocatable: {
                  memory_mib: 15360,
                  core_units: 100,
                },
                available: null,
              },
            ],
          },
        }}
        labels={labels}
      />,
    );

    expect(screen.queryByText("- GiB")).toBeNull();
  });

  it("labels product and node filters for assistive technology", () => {
    render(
      <GpuDeviceResourcesView nodeResources={nodeResources} labels={labels} />,
    );

    screen.getByRole("combobox", { name: "Product" });
    screen.getByRole("combobox", { name: "Node" });
  });

  it("keeps GPU number stable by UUID sort within each node", () => {
    render(
      <GpuDeviceResourcesView
        nodeResources={{
          "node-a": {
            ...nodeResources["node-a"],
            devices: [
              {
                uuid: "GPU-bbbbbbbb-2222-3333-4444-555555555555",
                product: "Tesla-T4",
                health: true,
                allocatable: { memory_mib: 15360, core_units: 100 },
                available: { memory_mib: 15360, core_units: 100 },
              },
              {
                uuid: "GPU-aaaaaaaa-2222-3333-4444-555555555555",
                product: "Tesla-T4",
                health: true,
                allocatable: { memory_mib: 15360, core_units: 100 },
                available: { memory_mib: 15360, core_units: 100 },
              },
            ],
          },
          "node-b": {
            allocatable: null,
            available: null,
            devices: [
              {
                uuid: "GPU-cccccccc-2222-3333-4444-555555555555",
                product: "Tesla-T4",
                health: true,
                allocatable: { memory_mib: 15360, core_units: 100 },
                available: { memory_mib: 15360, core_units: 100 },
              },
            ],
          },
        }}
        labels={labels}
      />,
    );

    const gpuButtons = screen.getAllByRole("button", {
      name: /GPU \d Copy UUID/,
    });
    expect(gpuButtons.map((button) => button.getAttribute("title"))).toEqual([
      "Copy UUID",
      "Copy UUID",
      "Copy UUID",
    ]);
    expect(gpuButtons.map((button) => button.textContent)).toEqual([
      "GPU 1Copy UUID",
      "GPU 2Copy UUID",
      "GPU 1Copy UUID",
    ]);
    expect(
      screen.queryByTitle("GPU-aaaaaaaa-2222-3333-4444-555555555555"),
    ).toBeNull();
  });

  it("renders compact cards without table or filters", () => {
    render(
      <GpuDeviceResourcesView
        nodeResources={nodeResources}
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        labels={labels}
        variant="cards"
        showHeader={false}
        showFilters={false}
        showSummary={false}
        request={{
          allocationMode: "vgpu",
          memoryMiBPerCard: 4096,
          coreUnitsPerCard: 0,
        }}
      />,
    );

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    screen.getByText("GPU 1");
    screen.getByText("Node");
    screen.getByText("node-a");
    screen.getByText("Product");
    screen.getByText("Tesla-T4");
    fireEvent.click(
      screen.getByRole("button", {
        name: "GPU 1 Copy UUID",
      }),
    );
    expect(copyMock).toHaveBeenCalledWith(
      "GPU-11111111-2222-3333-4444-555555555555",
      expect.any(Object),
    );
    screen.getByText("Usable");
  });

  it("renders an unhealthy card as out of service rather than idle", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <GpuDeviceResourcesView
          nodeResources={{
            "node-a": {
              ...nodeResources["node-a"],
              devices: [
                {
                  uuid: "GPU-dead",
                  product: "Tesla-T4",
                  health: false,
                  // How the backend reports an unhealthy device: both pools zeroed.
                  allocatable: { memory_mib: 0, core_units: 0 },
                  available: { memory_mib: 0, core_units: 0 },
                },
              ],
            },
          }}
          labels={labels}
          variant="grid"
          showHeader={false}
          showFilters={false}
          showSummary={false}
          showNodeColumn={false}
        />
      </TooltipProvider>,
    );

    screen.getByText("Unhealthy");

    // "0 / 0" would read as an idle card with capacity to spare. There is no
    // reading at all, so both metrics show a dash.
    expect(screen.queryByText("0.0 / 0.0 GiB")).toBeNull();
    expect(screen.queryByText("0 / 0")).toBeNull();
    expect(screen.getAllByText("-")).toHaveLength(6);

    // Bars carry no fill.
    for (const bar of screen.getAllByTestId("progress")) {
      expect(bar.getAttribute("data-value")).toBe("0");
    }
  });

  it("renders a compact device grid for node details", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <GpuDeviceResourcesView
          nodeResources={nodeResources}
          labels={labels}
          variant="grid"
          showHeader={false}
          showFilters={false}
          showSummary={false}
          showNodeColumn={false}
        />
      </TooltipProvider>,
    );

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    screen.getByText("GPU 1");
    screen.getByText("Healthy");
    screen.getByText("7.5 / 15.0 GiB");
    screen.getByText("50 / 100");
    expect(screen.getAllByText("50%")).toHaveLength(2);
    expect(screen.getAllByText("Remaining")).toHaveLength(2);
    screen.getByText("7.5 GiB");
    screen.getByText("50");
    expect(screen.getAllByTestId("progress")).toHaveLength(2);
    // Two cards of one node are told apart by the visible product name.
    expect(screen.getByTestId("gpu-cell-product").textContent).toBe("Tesla-T4");
    // And it stays out of the tab order while nothing is clipped: its tooltip
    // would only repeat what is already on screen.
    expect(
      screen.getByTestId("gpu-cell-product").getAttribute("tabindex"),
    ).toBe(null);

    fireEvent.mouseEnter(screen.getByTestId("gpu-cell-product"));

    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "GPU 1 Copy UUID" }));
    expect(copyMock).toHaveBeenCalledWith(
      "GPU-11111111-2222-3333-4444-555555555555",
      expect.any(Object),
    );
  });

  it("keeps a truncated cell product reachable from the keyboard", async () => {
    const longProduct = "NVIDIA_RTX_5000_Ada_Generation_Server_Edition";
    vi.mocked(useIsTruncated).mockReturnValue(true);

    render(
      <TooltipProvider delayDuration={0}>
        <GpuDeviceResourcesView
          nodeResources={{
            "node-a": {
              ...nodeResources["node-a"],
              devices: [
                {
                  uuid: "GPU-long-01",
                  product: longProduct,
                  health: true,
                  allocatable: { memory_mib: 81920, core_units: 100 },
                  available: { memory_mib: 81920, core_units: 100 },
                },
              ],
            },
          }}
          labels={labels}
          variant="grid"
          showHeader={false}
          showFilters={false}
          showSummary={false}
          showNodeColumn={false}
        />
      </TooltipProvider>,
    );

    const product = screen.getByTestId("gpu-cell-product");
    expect(product.textContent).toBe(longProduct);
    expect(product.getAttribute("tabindex")).toBe("0");
    // Nothing carries the name as a native title any more: it is either visible
    // or it is on the tooltip, and both are reachable without a pointer.
    expect(product.closest("[title]")).toBeNull();

    fireEvent.focus(product);

    expect((await screen.findByRole("tooltip")).textContent).toBe(longProduct);
  });

  it("uses free and allocated labels when no request fit context is provided", () => {
    render(
      <GpuDeviceResourcesView
        nodeResources={nodeResources}
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        labels={labels}
        variant="cards"
        showHeader={false}
        showFilters={false}
        showSummary={false}
      />,
    );

    screen.getByText("Allocated");
    expect(screen.queryByText("Usable")).toBeNull();
  });

  it("keeps compact card resource controls scoped to filtering only", () => {
    render(
      <GpuDeviceResourcesView
        nodeResources={nodeResources}
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        labels={labels}
        variant="cards"
        showHeader={false}
        showFilters={false}
        showSummary={false}
        showResourceControls={true}
        request={{
          allocationMode: "vgpu",
          memoryMiBPerCard: 4096,
          coreUnitsPerCard: 0,
        }}
      />,
    );

    screen.getByTestId("gpu-device-resource-toolbar");
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    screen.getByText("All Devices");
    expect(screen.queryByText("Summary")).toBeNull();
    expect(screen.queryByText("Nodes")).toBeNull();
    expect(screen.queryByText("Table")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
