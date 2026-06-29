import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";
import { EndpointClusterGpuResourcesPanel } from "./EndpointClusterGpuResourcesPanel";

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

const findByExactLabel = (cards: HTMLElement[], label: string) => {
  const card = cards.find((item) => within(item).queryByText(label));

  expect(card).toBeTruthy();

  return card as HTMLElement;
};

const resourceInfo: ClusterResourceInfo = {
  allocatable: {
    cpu: 64,
    memory: 256,
    accelerator_groups: {
      nvidia_gpu: {
        quantity: 2,
        product_groups: null,
        products: {
          "Tesla-T4": {
            quantity: 2,
          },
        },
      },
    },
  },
  available: {
    cpu: 48,
    memory: 192,
    accelerator_groups: {
      nvidia_gpu: {
        quantity: 2,
        product_groups: null,
        products: {
          "Tesla-T4": {
            quantity: 2,
          },
        },
      },
    },
  },
  node_resources: {
    "node-a": {
      allocatable: {
        cpu: 32,
        memory: 128,
        accelerator_groups: null,
      },
      available: {
        cpu: 24,
        memory: 96,
        accelerator_groups: null,
      },
      devices: [
        {
          uuid: "GPU-free",
          product: "Tesla-T4",
          health: true,
          allocatable: {
            memory_mib: 15360,
            core_units: 100,
          },
          available: {
            memory_mib: 15360,
            core_units: 100,
          },
        },
        {
          uuid: "GPU-partial",
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
  },
};

describe("EndpointClusterGpuResourcesPanel", () => {
  it("counts only fully free devices as usable when no request context exists", () => {
    render(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={true}
        t={t}
      />,
    );

    expect(
      screen.getByText((_, node) => node?.textContent === "Usable 1"),
    ).toBeTruthy();
    expect(screen.getAllByLabelText("Usable")).toHaveLength(1);
    expect(screen.getAllByLabelText("Allocated")).toHaveLength(1);
  });

  it("shows resource units in card titles instead of appending them to every value", () => {
    render(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={true}
        t={t}
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

    expect(within(cpuCard).getByText("cores")).toBeTruthy();
    expect(within(memoryCard).getByText("GiB")).toBeTruthy();
    expect(within(vramCard).getByText("GiB")).toBeTruthy();
    expect(within(cardCountCard).queryByText("cores")).toBeNull();
    expect(within(cardCountCard).queryByText("GiB")).toBeNull();
    expect(within(coreCard).queryByText("cores")).toBeNull();
    expect(within(coreCard).queryByText("GiB")).toBeNull();

    expect(within(cpuCard).queryByText("32.0 cores")).toBeNull();
    expect(within(memoryCard).queryByText("128.0 GiB")).toBeNull();
    expect(within(cpuCard).getByText("32.0")).toBeTruthy();
    expect(within(memoryCard).getByText("128.0")).toBeTruthy();
    expect(vramCard.textContent).not.toContain("7.5 / 30.0 GiB");
    expect(
      within(vramCard).getByText((text) => text.includes("7.5 / 30.0")),
    ).toBeTruthy();
    expect(coreCard.textContent).not.toContain("cores");
    expect(coreCard.textContent).not.toContain("GiB");
    expect(
      within(coreCard).getByText((text) => text.includes("50.0 / 200.0")),
    ).toBeTruthy();
  });
});
