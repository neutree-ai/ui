import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";
import { GpuCardResourcesView } from "./GpuCardResourcesView";

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: { value: number }) => (
    <div data-testid="progress" data-value={value} />
  ),
}));

const labels = {
  title: "Cluster Resources",
  productCount: "Card Products",
  physicalGpu: "Card Count",
  singleCardMemory: "VRAM",
  memoryUsage: "VRAM",
  coreUsage: "Core",
  allProducts: "All Card Products",
  searchPlaceholder: "Search card product or type",
  acceleratorType: "Accelerator Type",
  product: "Accelerator Product",
  selected: "Selected",
  remaining: "Remaining",
  usedSlashTotal: "used / total",
  empty: "No accelerator cards found",
};

const resourceInfo: ClusterResourceInfo = {
  allocatable: {
    cpu: 16,
    memory: 64,
    accelerator_groups: {
      nvidia_gpu: {
        quantity: 2,
        product_groups: null,
        products: {
          "Tesla-T4": {
            quantity: 2,
            virtualization: {
              memory_mib: 30720,
              core_units: 200,
            },
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
            virtualization: {
              memory_mib: 15360,
              core_units: 100,
            },
          },
        },
      },
    },
  },
  accelerator_metadata: {
    nvidia_gpu: {
      products: {
        "Tesla-T4": {
          memory_total_mib: 15360,
        },
      },
    },
  },
  node_resources: null,
};

describe("GpuCardResourcesView", () => {
  it("shows virtual card pools when virtualization is enabled", () => {
    render(
      <GpuCardResourcesView
        resourceInfo={resourceInfo}
        labels={labels}
        virtualizationEnabled={true}
      />,
    );

    expect(screen.getByText("Cluster Resources")).toBeTruthy();
    expect(screen.getAllByText("VRAM").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Core").length).toBeGreaterThan(0);
    expect(screen.getAllByText("15360 MiB").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Remaining").length).toBeGreaterThan(0);
  });

  it("hides virtual card pools when virtualization is disabled", () => {
    render(
      <GpuCardResourcesView
        resourceInfo={resourceInfo}
        labels={labels}
        virtualizationEnabled={false}
      />,
    );

    expect(screen.getByText("Cluster Resources")).toBeTruthy();
    expect(screen.getAllByText("Card Count").length).toBeGreaterThan(0);
    expect(screen.getByText("15360 MiB")).toBeTruthy();
    expect(screen.getAllByText("VRAM").length).toBe(1);
    expect(screen.queryByText("Core")).toBeNull();
  });

  it("renders compact cards without table or filters", () => {
    render(
      <GpuCardResourcesView
        resourceInfo={resourceInfo}
        labels={labels}
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={true}
        variant="cards"
        showHeader={false}
        showFilters={false}
        showSummary={false}
      />,
    );

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Tesla-T4")).toBeTruthy();
    expect(screen.getByText("nvidia_gpu")).toBeTruthy();
    expect(screen.getByText("Selected")).toBeTruthy();
    expect(screen.getByText("Card Count")).toBeTruthy();
    expect(screen.getAllByText("VRAM").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Remaining/).length).toBeGreaterThan(0);
  });

  it("keeps core and memory usage on one compact card row", () => {
    render(
      <GpuCardResourcesView
        resourceInfo={resourceInfo}
        labels={labels}
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={true}
        variant="cards"
        showHeader={false}
        showFilters={false}
        showSummary={false}
      />,
    );

    const usageRow = screen.getByTestId("gpu-card-resource-usage-row");
    expect(usageRow.className).toContain("grid-cols-2");
    expect(screen.getByText("Core")).toBeTruthy();
    expect(screen.getAllByText("VRAM").length).toBeGreaterThan(0);
  });
});
