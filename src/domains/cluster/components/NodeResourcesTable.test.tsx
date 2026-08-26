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

  it("aligns expanded node GPU cards to at most four shared columns", () => {
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
      expect(grid.style.gridTemplateColumns).toBe(
        "repeat(4, minmax(172px, 1fr))",
      );
    }

    // Five cards wrap to a second row and one card keeps the same four-column
    // topology, so both nodes need three placeholders.
    expect(screen.getAllByTestId("gpu-device-grid-empty-cell")).toHaveLength(6);
  });
});
