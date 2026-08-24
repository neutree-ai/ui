import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { NodeResourceStatus } from "@/foundation/types/resource-types";
import { GpuDeviceResourcesView } from "./GpuDeviceResourcesView";

const copyMock = vi.fn();

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div data-testid="progress" data-value={value} className={className} />
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
  });

  it("renders GPU number, copyable UUID, remaining pools, and no slots column", () => {
    render(
      <GpuDeviceResourcesView
        nodeResources={nodeResources}
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        labels={labels}
      />,
    );

    expect(screen.getByText("GPU Device Resources")).toBeTruthy();
    expect(screen.getByText("GPU 1")).toBeTruthy();
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
    expect(screen.getByText("Tesla-T4")).toBeTruthy();
    expect(screen.getByText("Selected")).toBeTruthy();
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

    expect(screen.getByText("Tesla-T4")).toBeTruthy();
    expect(screen.queryByText("Selected")).toBeNull();
  });

  it("orders device table resources as VRAM before core", () => {
    render(
      <GpuDeviceResourcesView nodeResources={nodeResources} labels={labels} />,
    );

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([
      "GPU",
      "Status",
      "Node",
      "Product",
      "Memory Usage",
      "Core Usage",
    ]);
  });

  it("centers the device status column", () => {
    render(
      <GpuDeviceResourcesView nodeResources={nodeResources} labels={labels} />,
    );

    expect(
      screen.getByRole("columnheader", { name: "Status" }).className,
    ).toContain("text-center");
    expect(
      screen.getByRole("img", { name: "Healthy" }).closest("td")?.className,
    ).toContain("text-center");
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
    expect(unhealthyIndicator.className).not.toContain("cursor-");
    expect(unhealthyIndicator.className).toContain("focus-visible:ring-2");

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

    expect(screen.getByRole("combobox", { name: "Product" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Node" })).toBeTruthy();
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
    expect(screen.getByText("GPU 1")).toBeTruthy();
    expect(screen.getByText("Node")).toBeTruthy();
    expect(screen.getByText("node-a")).toBeTruthy();
    expect(screen.getByText("Product")).toBeTruthy();
    expect(screen.getByText("Tesla-T4")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "GPU 1 Copy UUID",
      }),
    );
    expect(copyMock).toHaveBeenCalledWith(
      "GPU-11111111-2222-3333-4444-555555555555",
      expect.any(Object),
    );
    expect(screen.getByText("Usable")).toBeTruthy();
    const usageRow = screen.getByTestId("gpu-device-resource-usage-row");
    expect(usageRow.className).toContain("grid-cols-2");
  });

  it("renders an unhealthy card as out of service rather than idle", () => {
    render(
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
      />,
    );

    expect(screen.getByText("Unhealthy")).toBeTruthy();

    // "0 / 0" would read as an idle card with capacity to spare. There is no
    // reading at all, so both metrics show a dash.
    expect(screen.queryByText("0.0 / 0.0 GiB")).toBeNull();
    expect(screen.queryByText("0 / 0")).toBeNull();
    expect(screen.getAllByText("\u2014")).toHaveLength(2);

    // Bars carry no fill and use the dashed no-reading track.
    const bars = screen.getAllByTestId("progress");
    expect(bars).toHaveLength(2);
    for (const bar of bars) {
      expect(bar.getAttribute("data-value")).toBe("0");
      expect(bar.className).toContain("border-dashed");
      expect(bar.className).toContain("[&>div]:bg-transparent");
    }

    // The cell itself is dimmed by tokens, not by a blanket opacity that would
    // also wash out the Unhealthy badge.
    const cell = screen.getByText("GPU 1").closest("div")
      ?.parentElement as HTMLElement;
    expect(cell.className).toContain("var(--nt-fill-neutral-trans-3)");
    expect(cell.className).not.toContain("opacity-");
  });

  it("renders a compact device grid for node details", () => {
    render(
      <GpuDeviceResourcesView
        nodeResources={nodeResources}
        labels={labels}
        variant="grid"
        showHeader={false}
        showFilters={false}
        showSummary={false}
        showNodeColumn={false}
      />,
    );

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("GPU 1")).toBeTruthy();
    expect(screen.getByText("Healthy")).toBeTruthy();
    expect(screen.getByText("7.5 / 15.0 GiB")).toBeTruthy();
    expect(screen.getByText("50 / 100")).toBeTruthy();
    expect(screen.getAllByTestId("progress")).toHaveLength(2);
    expect(screen.queryByText("Tesla-T4")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "GPU 1 Copy UUID" }));
    expect(copyMock).toHaveBeenCalledWith(
      "GPU-11111111-2222-3333-4444-555555555555",
      expect.any(Object),
    );
  });

  it("pads a node device grid to the shared topology column count", () => {
    render(
      <GpuDeviceResourcesView
        nodeResources={nodeResources}
        labels={labels}
        variant="grid"
        gridColumns={4}
        showHeader={false}
        showFilters={false}
        showSummary={false}
        showNodeColumn={false}
      />,
    );

    expect(
      screen.getByTestId("gpu-device-grid").style.gridTemplateColumns,
    ).toBe("repeat(4, minmax(172px, 1fr))");
    expect(screen.getAllByTestId("gpu-device-grid-empty-cell")).toHaveLength(3);
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

    expect(screen.getByText("Allocated")).toBeTruthy();
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

    expect(screen.getByTestId("gpu-device-resource-toolbar")).toBeTruthy();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getByText("All Devices")).toBeTruthy();
    expect(screen.queryByText("Summary")).toBeNull();
    expect(screen.queryByText("Nodes")).toBeNull();
    expect(screen.queryByText("Table")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
