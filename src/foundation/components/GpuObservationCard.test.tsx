import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EMPTY_VALUE } from "@/foundation/components/EmptyValue";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import type { GpuAllocation } from "@/foundation/lib/accelerator-observations";
import { makeAcceleratorSample as sample } from "@/foundation/testing/resource-builders";
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
    render(<GpuObservationTableHeader variant="inventory" />);

    screen.getByText("clusters.fields.gpuNumber");
    screen.getByText("clusters.fields.health");
    screen.getByText("observations.vramAllocation");
    screen.getByText("observations.utilization");
    screen.getByText("observations.computeShare");
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

    fireEvent.click(row);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("gpu");
    expect(dialog.textContent).toContain("model");
    within(dialog).getAllByText("instance");
    expect(
      within(dialog).queryByRole("button", {
        name: /observations\.(expand|collapse)Allocation/,
      }),
    ).toBeNull();
    within(dialog).getByText("extension-arch");
    expect(within(dialog).queryByText("wrong-node")).toBeNull();
  });

  it("keeps replica usage unknown when no per-Endpoint sample exists", () => {
    render(card({ replica: allocation }));

    screen.getByText("observations.noMeasurement");
    const row = screen.getByTestId("gpu-allocation-row");
    expect(row.textContent).toContain(EMPTY_VALUE);
    // "Unused" is reserved minus actual, so with no measurement there is no
    // number to print — the line is omitted rather than shown as a dash.
    expect(row.textContent).not.toContain("observations.allocatedUnused");
  });

  it("keeps the physical-card allocation bar when one Endpoint owns the GPU", () => {
    const partialAllocation = {
      ...allocation,
      memoryMiB: 8 * 1024,
    };
    render(
      card({
        allocations: [partialAllocation],
        device: {
          ...device,
          allocatedMiB: 8 * 1024,
        },
        replica: partialAllocation,
      }),
    );

    fireEvent.click(screen.getByTestId("gpu-allocation-row"));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("8.0 / 15.0 GiB");
    within(dialog).getByRole("group", {
      name: "observations.allocationByEndpoint",
    });
    within(dialog).getByRole("button", {
      name: /instance, 8\.0 GiB observations\.reservedLower/,
    });
    within(dialog).getByText("observations.endpointCount:1");
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

  it("shows composition in the tooltip and on the hovered segment", async () => {
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
    expect(tooltip.textContent).toContain("12.0 GiB");
    expect(tooltip.textContent).toMatch(/observations\.actualOfReserved:80/);
  });

  it("omits composition rows that have no data from the tooltip", async () => {
    render(
      card({
        variant: "inventory",
        allocations: [
          {
            ...allocation,
            modelWeightsMiB: null,
            kvCacheCapacityMiB: null,
          },
        ],
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

    const tooltip = await screen.findByTestId("endpoint-allocation-preview");
    within(tooltip).getByText("observations.reservedVram");
    within(tooltip).getByText("observations.actualVramUsage");
    expect(within(tooltip).queryByText("observations.modelWeights")).toBeNull();
    expect(
      within(tooltip).queryByText("observations.l0KvCacheCapacity"),
    ).toBeNull();
    expect(
      within(tooltip).queryByText("observations.otherReservation"),
    ).toBeNull();
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
    for (const endpoint of ["endpoint-7", "endpoint-8"]) {
      within(bar).getByRole("button", {
        name: new RegExp(endpoint),
      });
    }

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

  it("uses the whole card as the details trigger", () => {
    render(card({ variant: "inventory", display: "cards" }));

    const cardElement = screen.getByTestId("gpu-inventory-card");
    within(cardElement).getByRole("button", {
      name: "clusters.fields.gpuNumber 0 clusters.actions.copyUuid",
    });
    fireEvent.click(cardElement);

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
    within(cardElement).getByText("observations.vramUsageAllocationTotal");
    within(cardElement).getByRole("img", {
      name: "observations.noEndpointAllocation",
    });
    expect(
      within(cardElement).queryByText("observations.actualMemory"),
    ).toBeNull();
    within(cardElement).getByText("observations.utilization");
    expect(
      within(cardElement).queryByText("observations.endpoints"),
    ).toBeNull();
    expect(within(cardElement).queryByText("clusters.options.free")).toBeNull();
  });

  it("does not invent a physical scale when physical VRAM is unknown", () => {
    render(
      card({
        variant: "inventory",
        display: "cards",
        device: {
          ...device,
          totalMiB: null,
        },
      }),
    );

    const cardElement = screen.getByTestId("gpu-inventory-card");
    within(cardElement).getByText("observations.physicalVramUnavailable");
    expect(cardElement.textContent).toContain(
      `${EMPTY_VALUE} / 15.0 / ${EMPTY_VALUE} GiB`,
    );
  });

  it("shows VRAM usage, allocation, total and GPU utilization", () => {
    render(
      card({
        variant: "inventory",
        display: "cards",
        samples: [
          sample("neutree_accelerator_memory_total_bytes", 16 * 1024 ** 3),
          sample("neutree_accelerator_memory_used_bytes", 8 * 1024 ** 3),
          sample("neutree_accelerator_utilization_ratio", 0.5),
        ],
      }),
    );

    const cardElement = screen.getByTestId("gpu-inventory-card");
    within(cardElement).getByText("observations.vramUsageAllocationTotal");
    expect(cardElement.textContent).toContain("8.0 / 15.0 / 16.0 GiB");
    within(cardElement).getByText("50%");
    within(cardElement).getByRole("progressbar", {
      name: "observations.utilization",
    });
  });

  it("shows allocated GPU compute in the cluster card", () => {
    render(
      card({
        variant: "inventory",
        display: "cards",
        device: {
          ...device,
          coreUnits: 100,
          availableCoreUnits: 0,
        },
      }),
    );

    const cardElement = screen.getByTestId("gpu-inventory-card");
    within(cardElement).getByText("observations.computeShare");
    expect(cardElement.textContent).toContain("100 / 100");
    within(cardElement).getByRole("progressbar", {
      name: "observations.computeAllocation",
    });
  });

  it("keeps allocation visible when the GPU is unhealthy", () => {
    render(
      card({
        variant: "inventory",
        display: "cards",
        device: {
          ...device,
          healthy: false,
        },
      }),
    );

    const cardElement = screen.getByTestId("gpu-inventory-card");
    within(cardElement).getByText("clusters.options.unhealthy");
    within(cardElement).getByRole("button", { name: /^instance,/ });
    within(cardElement).getByText("observations.vramUsageAllocationTotal");
  });

  it("keeps usage unknown without hiding allocation", () => {
    render(
      card({
        variant: "inventory",
        display: "cards",
        samples: [],
      }),
    );

    const cardElement = screen.getByTestId("gpu-inventory-card");
    within(cardElement).getByText("observations.vramUsageAllocationTotal");
    expect(cardElement.textContent).toContain(
      `${EMPTY_VALUE} / 15.0 / 15.0 GiB`,
    );
    within(cardElement).getByRole("button", { name: /^instance,/ });
  });

  it("shows allocation unknown without fabricating owner segments", () => {
    render(
      card({
        variant: "inventory",
        display: "cards",
        device: {
          ...device,
          allocatedMiB: null,
        },
      }),
    );

    const cardElement = screen.getByTestId("gpu-inventory-card");
    within(cardElement).getByRole("img", {
      name: "observations.allocationUnknown",
    });
    within(cardElement).getByText("observations.allocationUnknown");
    expect(
      within(cardElement).queryByRole("button", { name: /^instance,/ }),
    ).toBeNull();
  });

  const openDetails = () =>
    fireEvent.click(
      screen.getByRole("button", { name: "observations.detailsForGpu:0" }),
    );

  it("shows an over-reservation usage bar without an empty composition legend", () => {
    const usageOnly = {
      ...allocation,
      memoryMiB: 24 * 1024,
      modelWeightsMiB: null,
      kvCacheCapacityMiB: null,
    };
    render(
      card({
        allocations: [usageOnly],
        device: { ...device, totalMiB: 48 * 1024 },
        samples: [
          sample("neutree_accelerator_memory_total_bytes", 48 * 1024 ** 2),
          sample("neutree_accelerator_memory_used_bytes", 0),
          sample("neutree_accelerator_utilization_ratio", 0),
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            31 * 1024 ** 3,
            { endpoint: "instance", replica: "pod" },
          ),
        ],
      }),
    );

    openDetails();
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("31.0 GiB");
    expect(dialog.textContent).toContain("/ 24.0 GiB");
    expect(dialog.textContent).toContain(
      "observations.exceedsReservedBy:7.0 GiB",
    );
    expect(dialog.textContent).not.toContain("observations.usedShare:129");
    expect(
      within(dialog).getByText("observations.vramActualOfTotal").parentElement
        ?.textContent,
    ).toContain("31.0");
    expect(dialog.textContent).not.toContain("observations.modelWeights");
    expect(dialog.textContent).not.toContain("observations.l0KvCache");
    expect(dialog.textContent).not.toContain("observations.otherReservation");
  });

  it("reports allocation that exceeds physical VRAM", () => {
    render(
      card({
        device: {
          ...device,
          totalMiB: 10 * 1024,
        },
      }),
    );

    openDetails();
    const dialog = screen.getByRole("dialog");
    within(dialog).getByText(
      "observations.allocationExceedsPhysicalBy:5.0 GiB",
    );
  });

  it("marks stale observations without discarding allocation", () => {
    const staleSample = sample("neutree_accelerator_utilization_ratio", 0.5);
    staleSample.observed_at = Math.floor(Date.now() / 1000) - 3 * 60 * 60;
    render(card({ samples: [staleSample] }));

    openDetails();
    const dialog = screen.getByRole("dialog");
    within(dialog).getByText("observations.staleSample");
    within(dialog).getByText("observations.vramAllocation");
  });

  it("keeps allocation when runtime observations are unavailable", () => {
    render(
      card({
        observationStatus: "unavailable",
        samples: [],
      }),
    );

    openDetails();
    const dialog = screen.getByRole("dialog");
    within(dialog).getByText("observations.status.unavailable");
    within(dialog).getByText("observations.vramAllocation");
  });

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

  it("keeps the nine hardware fields stable and leaves missing ones empty", () => {
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
    // No reported counter: the fixed grid shows the gaps itself.
    expect(dialog.textContent).not.toContain("observations.hardwareReported");
    expect(within(dialog).getAllByText(EMPTY_VALUE).length).toBeGreaterThan(0);
    // Endpoint and replica counts appear once in the VRAM summary, not duplicated in a footer.
    expect(
      within(dialog).getAllByText(/observations\.endpointCount/),
    ).toHaveLength(1);
    expect(
      within(dialog).getAllByText(/observations\.replicaAllocations/),
    ).toHaveLength(1);
  });

  it("hides NVIDIA-only interconnect fields on non-NVIDIA accelerators", () => {
    render(
      card({
        device: { ...device, product: "AMD_MI300X" },
        samples: [
          sample("neutree_node_accelerator_hardware_info", 1, {
            pcie_generation: "5",
          }),
        ],
      }),
    );

    openDetails();
    const dialog = screen.getByRole("dialog");

    within(dialog).getByText("Gen 5");
    expect(
      within(dialog).queryByText("observations.hardwareFields.nvlink"),
    ).toBeNull();
    expect(
      within(dialog).queryByText("observations.hardwareFields.nvswitch"),
    ).toBeNull();
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
    render(
      card({
        allocations: [allocation, other],
        samples: [
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            10 * 1024 ** 3,
            { endpoint: "instance", replica: "pod" },
          ),
        ],
      }),
    );

    openDetails();
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).queryAllByRole("button", { expanded: true }).length,
    ).toBe(0);

    // The bar is a control inside the sheet: no hover layer, a click selects.
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^instance, 15\.0 GiB/ }),
    );
    expect(
      within(dialog).queryAllByRole("button", { expanded: true }).length,
    ).toBe(1);
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
      within(dialog).queryAllByRole("button", { expanded: true }).length;

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

  it("keeps per-replica details even when values match", () => {
    const replicas = Array.from({ length: 3 }, (_, index) => ({
      ...allocation,
      replica: `pod-${index + 1}`,
      instance: `pod-${index + 1}`,
      memoryMiB: Math.round(7.8 * 1024),
    }));
    render(
      card({
        allocations: replicas,
        samples: replicas.map((replica) =>
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            6.8 * 1024 ** 3,
            { endpoint: replica.endpoint, replica: replica.replica },
          ),
        ),
      }),
    );

    openDetails();
    const dialog = screen.getByRole("dialog");

    within(dialog).getByText("observations.replicaLabel");
    within(dialog).getByText("observations.actual");
    within(dialog).getByText("observations.requestedCapacity");
    expect(within(dialog).queryByText("observations.usedColumn")).toBeNull();
    expect(dialog.textContent).not.toContain("uniformReplicaUsage");
  });
});
