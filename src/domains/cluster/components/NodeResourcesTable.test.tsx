import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NodeResourcesTable } from "./NodeResourcesTable";

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: { value: number }) => (
    <div data-testid="progress" data-value={value} />
  ),
}));

const t = (key: string, options?: Record<string, unknown>) =>
  key === "clusters.actions.toggleNodeDevices"
    ? `${options?.nodeName} localized devices`
    : key;

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

    expect(screen.queryByText("GPU-1")).toBeNull();
    expect(screen.queryByText("GPU-2")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "node-a localized devices" }),
    );

    expect(screen.getByText("clusters.sections.nodeDevices")).toBeTruthy();
    expect(screen.getAllByText("Tesla-T4").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", {
        name: "clusters.fields.gpuNumber 1, clusters.fields.deviceUuid GPU-1",
      }),
    ).toBeTruthy();
    expect(screen.queryByText("clusters.options.healthy")).toBeNull();
    expect(screen.queryByText("clusters.options.unhealthy")).toBeNull();
    expect(screen.getByText("7.5 / 15.0 GiB")).toBeTruthy();
    expect(screen.getByText("50 / 100")).toBeTruthy();
    expect(screen.queryByText(/slot/i)).toBeNull();
    expect(screen.queryByText("GPU-2")).toBeNull();
  });
});
