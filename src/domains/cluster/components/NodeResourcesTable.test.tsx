import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NodeResourcesTable } from "./NodeResourcesTable";

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: { value: number }) => (
    <div data-testid="progress" data-value={value} />
  ),
}));

const t = (key: string) => key;

describe("NodeResourcesTable", () => {
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
                  slots: 10,
                },
                available: {
                  memory_mib: 7680,
                  core_units: 50,
                  slots: 5,
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

    fireEvent.click(screen.getByRole("button", { name: "node-a devices" }));

    expect(screen.getByText("clusters.sections.nodeDevices")).toBeTruthy();
    expect(screen.getAllByText("Tesla-T4").length).toBeGreaterThan(0);
    expect(screen.getByText("GPU-1")).toBeTruthy();
    expect(screen.getByText("clusters.options.healthy")).toBeTruthy();
    expect(screen.getByText("7680 / 15360 MiB")).toBeTruthy();
    expect(screen.getByText("50 / 100")).toBeTruthy();
    expect(screen.getByText("5 / 10")).toBeTruthy();
    expect(screen.queryByText("GPU-2")).toBeNull();
  });
});
