import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  makeGpuDevice,
  makeNodeResources,
  makeResourceInfo,
} from "@/foundation/testing/resource-builders";
import { NodeResourcesTable } from "./NodeResourcesTable";

const t = (key: string, options?: Record<string, unknown>) => {
  if (key === "clusters.actions.toggleNodeDevices") {
    return `${options?.nodeName} localized devices`;
  }

  if (key === "clusters.fields.cardUsageSummary") {
    return `${options?.product} · ${options?.used} in use · ${options?.total} total`;
  }

  return key;
};

describe("NodeResourcesTable", () => {
  it("shows node device resource pools under the expanded node", () => {
    render(
      <NodeResourcesTable
        nodeResources={{
          "node-a": {
            allocatable: makeResourceInfo(16, 64, {
              "Tesla-T4": { quantity: 1 },
            }),
            available: makeResourceInfo(12, 48, {
              "Tesla-T4": { quantity: 1 },
            }),
            devices: [
              makeGpuDevice("GPU-1", { memory_mib: 7680, core_units: 50 }),
            ],
          },
          "node-b": makeNodeResources({
            devices: [
              {
                uuid: "GPU-2",
                product: "Tesla-A10",
                health: false,
              },
            ],
          }),
        }}
        acceleratorTypes={["nvidia_gpu"]}
        t={t}
      />,
    );

    screen.getByText("Tesla-T4 · 0 in use · 1 total");
    expect(screen.queryByText("GPU-2")).toBeNull();

    const row = screen.getByTestId("gpu-inventory-row");
    within(row).getByText("clusters.fields.gpuNumber 1");
    within(row).getByText("clusters.options.healthy");
    within(row).getByText("observations.endpointAllocationUnavailable");
    expect(row.textContent).toContain("7.5");
    expect(row.textContent).toContain("7.5 / 15.0 GiB");
    expect(row.textContent).not.toContain("observations.endpoints");
    expect(
      within(row).getByRole("button", {
        name: "clusters.fields.gpuNumber 1 clusters.actions.copyUuid",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "node-a localized devices" }),
    );
    expect(screen.queryByTestId("gpu-inventory-row")).toBeNull();
  });

  it("shows each node's L1 KV-Cache usage", () => {
    render(
      <NodeResourcesTable
        nodeResources={{
          "node-a": {
            allocatable: { cpu: 16, memory: 64, accelerator_groups: null },
            available: { cpu: 12, memory: 48, accelerator_groups: null },
            devices: [],
          },
        }}
        l1CacheByNode={{
          "node-a": {
            usedGiB: 12.5,
            capacityGiB: 32.0,
          },
        }}
        acceleratorTypes={[]}
        t={t}
      />,
    );

    screen.getByText("observations.l1KvCache 12.5 / 32.0 GiB");
    screen.getByText("39%");
  });

  it("renders the expanded GPU devices as cards when selected", () => {
    render(
      <NodeResourcesTable
        nodeResources={{
          "node-a": {
            allocatable: makeResourceInfo(16, 64, {
              "Tesla-T4": { quantity: 1 },
            }),
            available: makeResourceInfo(12, 48, {
              "Tesla-T4": { quantity: 1 },
            }),
            devices: [
              makeGpuDevice("GPU-1", { memory_mib: 7680, core_units: 50 }),
            ],
          },
        }}
        acceleratorTypes={["nvidia_gpu"]}
        gpuView="cards"
        t={t}
      />,
    );

    screen.getByTestId("gpu-inventory-card");
    expect(screen.queryByTestId("gpu-inventory-row")).toBeNull();
    expect(screen.queryByTestId("gpu-observation-product")).toBeNull();
  });

  it("keeps the product visible when devices on one node use different models", () => {
    render(
      <NodeResourcesTable
        nodeResources={{
          "node-a": {
            allocatable: makeResourceInfo(16, 64, {
              "Tesla-T4": { quantity: 1 },
              "Tesla-A10": { quantity: 1 },
            }),
            available: makeResourceInfo(12, 48, {
              "Tesla-T4": { quantity: 1 },
              "Tesla-A10": { quantity: 1 },
            }),
            devices: [
              makeGpuDevice(
                "GPU-1",
                { memory_mib: 7680, core_units: 50 },
                { product: "Tesla-T4" },
              ),
              makeGpuDevice(
                "GPU-2",
                { memory_mib: 7680, core_units: 50 },
                { product: "Tesla-A10" },
              ),
            ],
          },
        }}
        acceleratorTypes={["nvidia_gpu"]}
        gpuView="cards"
        t={t}
      />,
    );

    expect(screen.getAllByTestId("gpu-observation-product")).toHaveLength(2);
  });
});
