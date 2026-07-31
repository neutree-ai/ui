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
  "clusters.actions.copyUuid": "Copy UUID",
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

// Retags every device with `product`, leaving the rest of the fixture alone.
const withProduct = (
  info: ClusterResourceInfo,
  product: string,
): ClusterResourceInfo => ({
  ...info,
  node_resources: Object.fromEntries(
    Object.entries(info.node_resources ?? {}).map(([nodeName, node]) => [
      nodeName,
      { ...node, devices: node.devices?.map((d) => ({ ...d, product })) },
    ]),
  ),
});

describe("EndpointClusterGpuResourcesPanel", () => {
  it("shows node GPU device cards when virtualization is disabled but devices exist", () => {
    render(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={false}
        t={t}
      />,
    );

    expect(screen.getByTestId("endpoint-node-gpu-card-grid")).toBeTruthy();
    const clusterSummary = within(
      screen.getByTestId("endpoint-cluster-resource-summary"),
    );
    expect(clusterSummary.getByText("Memory Usage")).toBeTruthy();
    expect(clusterSummary.getByText("Core Usage")).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "GPU 1 Copy UUID",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "GPU 2 Copy UUID",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText((_, node) => node?.textContent === "Usable 1"),
    ).toBeTruthy();
  });

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

  it("falls back to compact node summaries when devices are missing", () => {
    render(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={{
          ...resourceInfo,
          node_resources: {
            "node-a": {
              allocatable: {
                cpu: 32,
                memory: 128,
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
                cpu: 24,
                memory: 96,
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
            },
          },
        }}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={true}
        t={t}
      />,
    );

    expect(screen.queryByTestId("endpoint-node-gpu-card-grid")).toBeNull();
    const compactResources = within(
      screen.getByTestId("endpoint-compact-node-resources"),
    );
    expect(compactResources.getByText("Card Count")).toBeTruthy();
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

  it("shows a long GPU product name in full on the device card", () => {
    // The card is only ~180px wide, so a vendor-prefixed name used to be
    // clipped with no way to read the rest of it.
    const longProduct = "NVIDIA-GeForce-RTX-4090";

    render(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={withProduct(resourceInfo, longProduct)}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: longProduct }}
        virtualizationEnabled={false}
        t={t}
      />,
    );

    const [card] = screen.getAllByTestId("endpoint-gpu-device-card");
    const productBadge = within(card).getByText(longProduct);

    // jsdom does no layout, so the class is the only thing that can pin "wraps
    // rather than clips"; the title is the hover fallback.
    expect(productBadge.className).not.toContain("truncate");
    expect(productBadge.getAttribute("title")).toBe(longProduct);
  });

  it("shows the cluster's reported GPU products in the header badge, not the preset product", () => {
    // A catalog/recipe preset can carry a product (e.g. "L4") the cluster does
    // not have; the "GPU Type" badge must reflect the cluster's actual GPUs.
    render(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "L4" }}
        virtualizationEnabled={true}
        t={t}
      />,
    );

    const toolbar = within(
      screen.getByTestId("endpoint-cluster-resource-target-notes"),
    );
    expect(toolbar.getByText("Tesla-T4")).toBeTruthy();
    expect(toolbar.queryByText("L4")).toBeNull();
  });

  it("keeps the header badge on cluster products when the preset accelerator matches", () => {
    render(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "Tesla-T4" }}
        virtualizationEnabled={true}
        t={t}
      />,
    );

    const toolbar = within(
      screen.getByTestId("endpoint-cluster-resource-target-notes"),
    );
    expect(toolbar.getByText("Tesla-T4")).toBeTruthy();
  });

  it("keeps cluster pool values visible when the preset accelerator matches no product", () => {
    // A recipe/catalog preset can carry a product name the cluster does not
    // report at all; the summary must fall back to the full pool instead of
    // rendering an all-dashes board (NEU-501).
    render(
      <EndpointClusterGpuResourcesPanel
        resourceInfo={resourceInfo}
        currentCluster="cluster-a"
        selectedAccelerator={{ type: "nvidia_gpu", product: "H100" }}
        virtualizationEnabled={true}
        t={t}
      />,
    );

    const summaryCards = screen.getAllByTestId(
      "endpoint-resource-summary-card",
    );
    const cardCountCard = findByExactLabel(summaryCards, "Card Count");
    const vramCard = findByExactLabel(summaryCards, "Memory Usage");

    expect(
      within(cardCountCard).getByText((text) => text.includes("1.0 / 2.0")),
    ).toBeTruthy();
    expect(cardCountCard.textContent).not.toContain("Used -");
    expect(
      within(vramCard).getByText((text) => text.includes("7.5 / 30.0")),
    ).toBeTruthy();
    expect(vramCard.textContent).not.toContain("Used -");
  });
});
