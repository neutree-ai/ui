import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    ).toBe("GPU-11111111-2222-3333-4444-555555555555");
    fireEvent.click(
      screen.getByRole("button", {
        name: "GPU 1, GPU UUID GPU-11111111-2222-3333-4444-555555555555",
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
      name: /GPU \d, GPU UUID/,
    });
    expect(gpuButtons.map((button) => button.getAttribute("title"))).toEqual([
      "GPU-aaaaaaaa-2222-3333-4444-555555555555",
      "GPU-bbbbbbbb-2222-3333-4444-555555555555",
      "GPU-cccccccc-2222-3333-4444-555555555555",
    ]);
    expect(gpuButtons.map((button) => button.textContent)).toEqual([
      "GPU 1Copy UUID",
      "GPU 2Copy UUID",
      "GPU 1Copy UUID",
    ]);
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
        name: "GPU 1, GPU UUID GPU-11111111-2222-3333-4444-555555555555",
      }),
    );
    expect(copyMock).toHaveBeenCalledWith(
      "GPU-11111111-2222-3333-4444-555555555555",
      expect.any(Object),
    );
    expect(screen.getByText("Allocated")).toBeTruthy();
    const usageRow = screen.getByTestId("gpu-device-resource-usage-row");
    expect(usageRow.className).toContain("grid-cols-2");
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
