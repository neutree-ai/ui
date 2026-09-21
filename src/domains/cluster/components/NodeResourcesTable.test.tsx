import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
  it("keeps the node devices toggle aligned with the node name", () => {
    render(
      <NodeResourcesTable
        nodeResources={{
          "node-a": {
            allocatable: null,
            available: null,
            devices: [
              {
                uuid: "GPU-1",
                product: "Tesla-T4",
                health: true,
              },
            ],
          },
        }}
        acceleratorTypes={["nvidia_gpu"]}
        t={t}
      />,
    );

    const toggleCell = screen
      .getByRole("button", { name: "node-a localized devices" })
      .closest("td");
    const nodeNameCell = screen.getByText("node-a").closest("td");

    expect(toggleCell).toBe(nodeNameCell);
  });

  it("shows node device resource pools under the expanded node", () => {
    render(
      <NodeResourcesTable
        nodeResources={{
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
                uuid: "GPU-1",
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
          "node-b": {
            allocatable: null,
            available: null,
            devices: [
              {
                uuid: "GPU-2",
                product: "Tesla-A10",
                health: false,
              },
            ],
          },
        }}
        acceleratorTypes={["nvidia_gpu"]}
        t={t}
      />,
    );

    expect(screen.getByText("Tesla-T4 · 0 in use · 1 total")).toBeTruthy();
    expect(screen.queryByText("GPU-1")).toBeNull();
    expect(screen.queryByText("GPU-2")).toBeNull();

    expect(
      screen.getByRole("button", {
        name: "clusters.fields.gpuNumber 1 clusters.actions.copyUuid",
      }),
    ).toBeTruthy();
    expect(screen.queryByTitle("GPU-1")).toBeNull();
    expect(screen.getByText("clusters.options.healthy")).toBeTruthy();
    expect(screen.queryByText("clusters.options.unhealthy")).toBeNull();
    expect(screen.getByText("7.5 / 15.0 GiB")).toBeTruthy();
    expect(screen.getByText("50 / 100")).toBeTruthy();
    const nodeProgressBars = screen.getAllByRole("progressbar").slice(0, 2);
    expect(nodeProgressBars[0].className).toContain("--nt-chart-series-4");
    expect(nodeProgressBars[1].className).toContain("--nt-chart-series-3");
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(screen.queryByText(/slot/i)).toBeNull();
    expect(screen.queryByText("GPU-2")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "node-a localized devices" }),
    );
    expect(
      screen.queryByRole("button", {
        name: "clusters.fields.gpuNumber 1 clusters.actions.copyUuid",
      }),
    ).toBeNull();
  });

  it("lets expanded node GPU cards wrap instead of pinning them to a count", () => {
    const devices = Array.from({ length: 5 }, (_, index) => ({
      uuid: `GPU-${index + 1}`,
      product: "Tesla-T4",
      health: true,
    }));

    render(
      <NodeResourcesTable
        nodeResources={{
          "node-a": {
            allocatable: null,
            available: null,
            devices,
          },
          "node-b": {
            allocatable: null,
            available: null,
            devices: [
              {
                uuid: "GPU-node-b-1",
                product: "Tesla-T4",
                health: true,
              },
            ],
          },
        }}
        acceleratorTypes={["nvidia_gpu"]}
        t={t}
      />,
    );

    const grids = screen.getAllByTestId("gpu-device-grid");
    expect(grids).toHaveLength(2);
    for (const grid of grids) {
      // The column count is the browser's call, so a node with more cards than
      // fit wraps onto another row rather than scrolling them out of reach.
      expect(grid.style.gridTemplateColumns).toBe(
        "repeat(auto-fit, minmax(188px, 1fr))",
      );
      expect(grid.style.minWidth).toBe("");
    }

    // Nothing is left to pad: the wrapped rows are the topology now.
    expect(screen.queryByTestId("gpu-device-grid-empty-cell")).toBeNull();
  });
});
