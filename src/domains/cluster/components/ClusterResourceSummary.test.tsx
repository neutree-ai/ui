import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";
import { ClusterResourceSummary } from "./ClusterResourceSummary";

const labels: Record<string, string> = {
  "common.fields.cpu": "CPU",
  "common.fields.memory": "Memory",
  "clusters.fields.physicalGpu": "GPU Cards",
  "clusters.fields.memoryUsage": "VRAM",
  "clusters.fields.coreUsage": "Core",
  "clusters.options.allocated": "Allocated",
  "clusters.options.used": "Used",
  "clusters.options.free": "Free",
};

const t = (key: string) => labels[key] ?? key;

type Group = { quantity?: number; product_groups: null; products: unknown };

const group = (
  quantity: number | undefined,
  products: Record<string, [number, number, number]> | null = null,
): Group => ({
  ...(quantity === undefined ? {} : { quantity }),
  product_groups: null,
  products:
    products &&
    Object.fromEntries(
      Object.entries(products).map(([name, [qty, memGiB, cores]]) => [
        name,
        {
          quantity: qty,
          virtualization: { memory_mib: memGiB * 1024, core_units: cores },
        },
      ]),
    ),
});

const makeInfo = ({
  allocatable = { nvidia_gpu: group(2, { "Tesla-T4": [2, 30, 200] }) },
  available = { nvidia_gpu: group(1, { "Tesla-T4": [1, 10, 50] }) },
}: {
  allocatable?: Record<string, Group> | null;
  available?: Record<string, Group> | null;
} = {}) =>
  ({
    allocatable: { cpu: 16, memory: 64, accelerator_groups: allocatable },
    available: available && {
      cpu: 12,
      memory: 48,
      accelerator_groups: available,
    },
    node_resources: null,
  }) as unknown as ClusterResourceInfo;

const renderSummary = (resourceInfo: ClusterResourceInfo) =>
  render(<ClusterResourceSummary resourceInfo={resourceInfo} t={t} />);

describe("ClusterResourceSummary", () => {
  it("does not render without allocatable resources", () => {
    const { container } = renderSummary({
      allocatable: null,
      available: null,
      node_resources: null,
    });

    expect(container.innerHTML).toBe("");
  });

  it("summarizes compute and accelerator allocation", () => {
    renderSummary(makeInfo());

    screen.getByText("4.0 / 16.0");
    expect(screen.getAllByText("25% used")).toHaveLength(2);
    screen.getByText("16.0 / 64.0");
    screen.getByRole("img", { name: "GPU Cards: 1 / 2" });
    screen.getByText("20.0 / 30.0");
    screen.getByText("67% used");
    screen.getByText("150 / 200");
    screen.getByText("75% used");
  });

  it("reports pooled usage as unknown when a product omits availability", () => {
    renderSummary(
      makeInfo({
        allocatable: {
          nvidia_gpu: group(4, {
            "Tesla-T4": [2, 30, 200],
            "NVIDIA-L20": [2, 40, 100],
          }),
        },
      }),
    );

    // The whole pool is unknown rather than the T4 share standing in for it,
    // which would have read as the L20 cards being fully consumed.
    screen.getByRole("progressbar", { name: "VRAM: - / 70.0" });
    screen.getByRole("progressbar", { name: "Core: - / 300" });
  });

  it("reports card allocation as unknown when the type omits availability", () => {
    renderSummary(
      makeInfo({ allocatable: { nvidia_gpu: group(2) }, available: null }),
    );

    screen.getByRole("img", { name: "GPU Cards: - / 2" });
  });

  it("treats an omitted quantity in an existing availability group as zero", () => {
    renderSummary(
      makeInfo({
        allocatable: { nvidia_gpu: group(1) },
        available: { nvidia_gpu: group(undefined) },
      }),
    );

    screen.getByText("1 / 1");
    screen.getByText("100% allocated");
    screen.getByText("0 cards");
  });

  it("uses a continuous meter with decimals for fractional card availability", () => {
    renderSummary(
      makeInfo({
        available: { nvidia_gpu: group(1.5, { "Tesla-T4": [1, 10, 50] }) },
      }),
    );

    screen.getByText("25% allocated");
    screen.getByText("1.5 cards");
    expect(screen.queryByRole("img", { name: /GPU Cards/ })).toBeNull();
    screen.getByRole("progressbar", { name: "GPU Cards: 0.5 / 2.0" });
  });

  it("keeps the meter continuous when fractional groups sum to an integer", () => {
    const halves = { nvidia_gpu: group(0.5), npu: group(0.5) };
    renderSummary(makeInfo({ allocatable: halves, available: halves }));

    expect(screen.queryByRole("img", { name: /GPU Cards/ })).toBeNull();
    screen.getByRole("progressbar", { name: "GPU Cards: 0.0 / 1.0" });
  });

  it("hides accelerator metrics when the cluster has no cards", () => {
    renderSummary(makeInfo({ allocatable: null, available: null }));

    screen.getByText("CPU");
    expect(screen.queryByText("GPU Cards")).toBeNull();
    expect(screen.queryByText("VRAM")).toBeNull();
    expect(screen.queryByText("Core")).toBeNull();
  });
});
