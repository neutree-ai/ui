import { render, screen } from "@testing-library/react";
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
  "clusters.options.unhealthy": "Unhealthy",
  "clusters.options.usable": "Usable",
  "endpoints.sections.clusterDeviceResources": "Cluster Resources",
};

const t = (key: string) => translations[key] ?? key;

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
});
