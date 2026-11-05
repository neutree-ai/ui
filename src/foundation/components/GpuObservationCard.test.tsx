import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import type {
  AcceleratorSample,
  GpuAllocation,
} from "@/foundation/lib/accelerator-observations";
import {
  GpuObservationCard,
  GpuObservationTableHeader,
} from "./GpuObservationCard";

const device = {
  node: "node",
  uuid: "gpu",
  index: 0,
  product: "T4",
  totalMiB: 15360,
  allocatedMiB: 15360,
  coreUnits: 50,
  healthy: true,
};

const allocation: GpuAllocation = {
  endpoint: "instance",
  model: "model",
  workspace: "default",
  node: "node",
  uuid: "gpu",
  replica: "pod",
  instance: "pod",
  memoryMiB: 15360,
  modelWeightsMiB: 2048,
  kvCacheCapacityMiB: 8192,
};

const sample = (
  metric: string,
  value: number,
  labels: Record<string, string> = {},
): AcceleratorSample => ({
  metric,
  value,
  observed_at: 1,
  labels: { node: "node", accelerator_uuid: "gpu", ...labels },
});

const card = (
  props: Partial<Parameters<typeof GpuObservationCard>[0]> = {},
) => (
  <MemoryRouter>
    <TooltipProvider>
      <GpuObservationCard
        device={device}
        samples={[]}
        allocations={[allocation]}
        {...props}
      />
    </TooltipProvider>
  </MemoryRouter>
);

describe("GPU observation row", () => {
  it("uses the merged inventory table columns", () => {
    const { container } = render(
      <MemoryRouter>
        <GpuObservationTableHeader variant="inventory" />
      </MemoryRouter>,
    );

    expect(
      [...(container.firstElementChild?.children ?? [])].map(
        (cell) => cell.textContent,
      ),
    ).toEqual([
      "clusters.fields.gpuNumber",
      "clusters.fields.health",
      "observations.vramAllocation",
      "observations.utilization",
      "",
    ]);
  });

  it("shows replica composition and keeps hardware details in the row action", () => {
    render(
      card({
        replica: allocation,
        samples: [
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            12 * 1024 ** 3,
            { endpoint: "instance", replica: "pod" },
          ),
          sample(
            "neutree_endpoint_replica_accelerator_utilization_ratio",
            0.75,
            { endpoint: "instance", replica: "pod" },
          ),
          sample("neutree_node_accelerator_example_info", 1, {
            driver_version: "extension-driver",
          }),
          sample("neutree_node_accelerator_hardware_info", 1, {
            driver_version: "generic-driver",
          }),
          sample("neutree_node_accelerator_example_info", 1, {
            node: "other",
            driver_version: "wrong-node",
          }),
        ],
      }),
    );

    const row = screen.getByTestId("gpu-allocation-row");
    expect(row.textContent).toContain("12.0");
    expect(row.textContent).toContain("15.0");
    expect(row.textContent).toContain("75%");
    expect(row.textContent).toContain("observations.modelWeights 2.0 GiB");
    expect(row.textContent).toContain("observations.l0KvCache 8.0 GiB");

    fireEvent.click(
      screen.getByRole("button", {
        name: "observations.detailsForGpu:0",
      }),
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("gpu");
    expect(dialog.textContent).toContain("model");
    within(dialog).getByText("extension-driver");
    expect(within(dialog).queryByText("wrong-node")).toBeNull();
  });

  it("keeps replica usage unknown when no per-Endpoint sample exists", () => {
    render(card({ replica: allocation }));

    screen.getByText("observations.noMeasurement");
    const row = screen.getByTestId("gpu-allocation-row");
    expect(row.textContent).toContain("—");
    expect(row.textContent).toContain("observations.allocatedUnused —");
  });

  it("keeps a truncated product name reachable from the keyboard", async () => {
    vi.mocked(useIsTruncated).mockReturnValue(true);
    render(
      card({
        device: {
          ...device,
          product: "NVIDIA-H200-NVL-141GB-HBM3e-SXM6-Module-for-HGX",
        },
      }),
    );

    const product = screen.getByTestId("gpu-observation-product");
    expect(product.getAttribute("tabindex")).toBe("0");
    fireEvent.focus(product);

    expect((await screen.findByRole("tooltip")).textContent).toContain(
      "NVIDIA-H200-NVL-141GB-HBM3e-SXM6-Module-for-HGX",
    );
  });

  it("reveals an Endpoint segment's memory composition on hover", async () => {
    render(
      card({
        variant: "inventory",
        samples: [
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            12 * 1024 ** 3,
            { endpoint: "instance", replica: "pod" },
          ),
        ],
      }),
    );

    fireEvent.focus(
      screen.getByRole("button", {
        name: /^instance, 15\.0 GiB/,
      }),
    );

    screen.getByTestId("endpoint-segment-weights-pattern");
    screen.getByTestId("endpoint-segment-kv-pattern");
    screen.getByTestId("endpoint-segment-remaining-pattern");
    screen.getByTestId("endpoint-segment-actual-marker");

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain("instance");
    expect(tooltip.textContent).toContain("observations.modelWeights");
    expect(tooltip.textContent).toContain("2.0 GiB");
    expect(tooltip.textContent).toContain("observations.l0KvCacheCapacity");
    expect(tooltip.textContent).toContain("8.0 GiB");
    expect(tooltip.textContent).toContain("observations.otherReservation");
    expect(tooltip.textContent).toContain("5.0 GiB");
    expect(tooltip.textContent).toContain("observations.actualVramUsage");
    within(tooltip).getByTestId("actual-marker-legend");
    expect(tooltip.textContent).toContain("12.0 GiB");
    expect(tooltip.textContent).toMatch(/observations\.actualOfReserved:80/);
  });

  it("keeps the first eight Endpoints individual and exposes the rest from More", async () => {
    const many = Array.from({ length: 9 }, (_, index) => ({
      ...allocation,
      endpoint: `endpoint-${index + 1}`,
      replica: `pod-${index + 1}`,
      instance: `pod-${index + 1}`,
      memoryMiB: 1024,
      modelWeightsMiB: 512,
      kvCacheCapacityMiB: 256,
    }));
    render(
      card({
        variant: "inventory",
        device: {
          ...device,
          totalMiB: 10 * 1024,
          allocatedMiB: 9 * 1024,
        },
        allocations: many,
      }),
    );

    const bar = screen.getByRole("group", {
      name: "observations.allocationByEndpoint",
    });
    expect(within(bar).getAllByRole("button")).toHaveLength(9);
    within(bar).getByRole("button", { name: /endpoint-8/ });

    const more = within(bar).getByRole("button", {
      name: /observations.moreAllocationsLabel/,
    });
    fireEvent.focus(more);

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain("endpoint-9");
    expect(tooltip.textContent).toContain("1.0 GiB");
  });

  it("uses the GPU name as the card details trigger", () => {
    render(card({ variant: "inventory", display: "cards" }));

    const cardElement = screen.getByTestId("gpu-inventory-card");
    within(cardElement).getByRole("button", {
      name: "clusters.fields.gpuNumber 0 clusters.actions.copyUuid",
    });
    fireEvent.click(
      within(cardElement).getByRole("button", {
        name: "observations.detailsForGpu:0",
      }),
    );

    expect(screen.getByRole("dialog").textContent).toContain("gpu");
  });

  it("shows an empty VRAM track when the card has no Endpoint allocation", () => {
    render(
      card({
        variant: "inventory",
        display: "cards",
        allocations: [],
        device: {
          ...device,
          allocatedMiB: 0,
        },
      }),
    );

    const cardElement = screen.getByTestId("gpu-inventory-card");
    within(cardElement).getByText("observations.vramAllocation");
    within(cardElement).getByText("observations.utilization");
    within(cardElement).getByRole("img", {
      name: "observations.noEndpointAllocation",
    });
    expect(
      within(cardElement).queryByText("observations.endpoints"),
    ).toBeNull();
    expect(within(cardElement).queryByText("clusters.options.free")).toBeNull();
  });
});
