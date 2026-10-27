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

    screen.getByText("Tesla-T4 · 0 in use · 1 total");
    expect(screen.queryByText("GPU-1")).toBeNull();
    expect(screen.queryByText("GPU-2")).toBeNull();

    screen.getByRole("button", {
      name: "clusters.fields.gpuNumber 1 clusters.actions.copyUuid",
    });
    expect(screen.queryByTitle("GPU-1")).toBeNull();
    screen.getByText("clusters.options.healthy");
    expect(screen.queryByText("clusters.options.unhealthy")).toBeNull();
    screen.getByText("7.5 / 15.0 GiB");
    screen.getByText("50 / 100");
    expect(screen.queryByText(/slot/i)).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "node-a localized devices" }),
    );
    expect(
      screen.queryByRole("button", {
        name: "clusters.fields.gpuNumber 1 clusters.actions.copyUuid",
      }),
    ).toBeNull();
  });
});
