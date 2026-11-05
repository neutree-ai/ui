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
            architecture: "extension-arch",
          }),
          sample("neutree_node_accelerator_hardware_info", 1, {
            architecture: "generic-arch",
          }),
          sample("neutree_node_accelerator_example_info", 1, {
            node: "other",
            architecture: "wrong-node",
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
    within(dialog).getByText("extension-arch");
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

    const tooltip = await screen.findByTestId("endpoint-allocation-preview");
    // The name is a way into the object, not just a label.
    expect(
      within(tooltip)
        .getByRole("link", { name: "instance" })
        .getAttribute("href"),
    ).toBe("/default/endpoints/show/instance");
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

    // Past eight named Endpoints the bar carries the list's numbers and a
    // neutral More marker, so colour is never the only identifier.
    expect(bar.textContent).toContain("+1");
    for (const index of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(bar.textContent).toContain(String(index));
    }

    const more = within(bar).getByRole("button", {
      name: /observations.moreAllocationsLabel/,
    });
    fireEvent.focus(more);

    const tooltip = await screen.findByTestId("gpu-more-preview");
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

  const openDetails = () =>
    fireEvent.click(
      screen.getByRole("button", { name: "observations.detailsForGpu:0" }),
    );

  it("shows an idle card as real zeros, not as a missing measurement", () => {
    render(
      card({
        allocations: [],
        device: { ...device, allocatedMiB: 0 },
        samples: [
          sample("neutree_accelerator_utilization_ratio", 0),
          sample("neutree_accelerator_memory_total_bytes", 15360 * 1024 ** 2),
          sample("neutree_accelerator_memory_used_bytes", 0),
        ],
      }),
    );

    openDetails();
    const dialog = screen.getByRole("dialog");

    within(dialog).getByText("observations.vramActualOfTotal");
    expect(dialog.textContent).toContain("0.0");
    expect(dialog.textContent).toContain("15.0 GiB");
    expect(dialog.textContent).toContain("0%");
    expect(dialog.textContent).not.toContain("observations.status.no_data");
  });

  it("keeps the nine hardware fields stable and counts what was reported", () => {
    render(
      card({
        samples: [
          sample("neutree_node_accelerator_hardware_info", 1, {
            architecture: "Hopper",
            pcie_generation: "5",
          }),
        ],
      }),
    );

    openDetails();
    const dialog = screen.getByRole("dialog");

    within(dialog).getByText("Hopper");
    within(dialog).getByText("Gen 5");
    // An unreported field keeps its slot: the grid must not reflow per device.
    within(dialog).getByText("observations.hardwareFields.numa_node");
    expect(dialog.textContent).toContain("observations.hardwareReported");
    expect(within(dialog).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("derives the FP16 estimate from utilisation and labels it as an estimate", () => {
    render(
      card({
        device: { ...device, peakFP16TFLOPS: 100 },
        samples: [sample("neutree_accelerator_utilization_ratio", 0.5)],
      }),
    );

    openDetails();
    const dialog = screen.getByRole("dialog");

    within(dialog).getByText("observations.fp16Estimate");
    // 50% of a 100 TFLOPS peak.
    expect(dialog.textContent).toContain("50.0");
    expect(dialog.textContent).toContain("100.0");
    expect(dialog.textContent).toContain("observations.tflopsPeak");
  });

  it("expands the matching card when a bar segment is clicked", () => {
    const other = {
      ...allocation,
      endpoint: "instance-2",
      model: "model-2",
      replica: "pod-2",
      instance: "pod-2",
    };
    render(card({ allocations: [allocation, other] }));

    openDetails();
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelectorAll('[aria-expanded="true"]').length).toBe(0);

    // The bar is a control inside the sheet: no hover layer, a click selects.
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^instance, 15\.0 GiB/ }),
    );
    expect(dialog.querySelectorAll('[aria-expanded="true"]').length).toBe(1);
    within(dialog).getByRole("link", {
      name: "observations.openEndpoint:instance",
    });
  });

  it("keeps the row name plain and offers one deliberate way out", () => {
    render(card({}));

    openDetails();
    const dialog = screen.getByRole("dialog");
    const openLink = within(dialog).getByRole("link", {
      name: "observations.openEndpoint:instance",
    });

    expect(openLink.getAttribute("href")).toBe(
      "/default/endpoints/show/instance",
    );
    // The name itself must not be a link: the row also expands on click.
    expect(within(dialog).queryByRole("link", { name: "instance" })).toBeNull();
  });

  it("keeps one Endpoint allocation expanded at a time", () => {
    const other = {
      ...allocation,
      endpoint: "instance-2",
      model: "model-2",
      replica: "pod-2",
      instance: "pod-2",
    };
    render(card({ allocations: [allocation, other] }));

    openDetails();
    const dialog = screen.getByRole("dialog");
    const expandedCount = () =>
      dialog.querySelectorAll('[aria-expanded="true"]').length;

    // Several Endpoints start collapsed; there is nothing to disambiguate for one.
    expect(expandedCount()).toBe(0);

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "observations.expandAllocation:instance",
      }),
    );
    expect(expandedCount()).toBe(1);
    // The expanded card carries its own legend instead of a duplicated bar.
    expect(dialog.textContent).toContain("observations.modelWeights");
    expect(dialog.textContent).toContain("2.0 GiB");

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "observations.expandAllocation:instance-2",
      }),
    );
    expect(expandedCount()).toBe(1);
  });
});
