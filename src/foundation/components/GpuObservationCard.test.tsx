import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AcceleratorSample } from "@/foundation/lib/accelerator-observations";
import { GpuObservationCard } from "./GpuObservationCard";

const device = {
  node: "node",
  uuid: "gpu",
  index: 0,
  product: "T4",
  totalMiB: 15360,
  allocatedMiB: 15360,
};
const allocation = {
  endpoint: "instance",
  model: "model",
  workspace: "default",
  node: "node",
  uuid: "gpu",
  replica: "pod",
  instance: "pod",
  memoryMiB: 15360,
  modelWeightsMiB: 2048,
  kvCacheCapacityMiB: 8192,
};
const sample = (
  metric: string,
  value: number,
  labels: Record<string, string> = {},
): AcceleratorSample => ({
  metric,
  value,
  observed_at: 1,
  labels: { node: "node", accelerator_uuid: "gpu", ...labels },
});
const samples = [
  sample("neutree_accelerator_memory_used_bytes", 13 * 1024 ** 3),
];
const card = (
  props: Partial<Parameters<typeof GpuObservationCard>[0]> = {},
) => (
  <MemoryRouter>
    <TooltipProvider>
      <GpuObservationCard
        device={device}
        samples={samples}
        allocations={[allocation]}
        {...props}
      />
    </TooltipProvider>
  </MemoryRouter>
);

describe("GPU observation card", () => {
  it("shows measured and allocated memory, links the instance and merges device hardware details", () => {
    render(
      card({
        samples: [
          ...samples,
          sample("neutree_node_accelerator_example_info", 1, {
            driver_version: "extension-driver",
          }),
          sample("neutree_node_accelerator_hardware_info", 1, {
            driver_version: "generic-driver",
          }),
          sample("neutree_node_accelerator_example_info", 1, {
            node: "other",
            driver_version: "wrong-node",
          }),
        ],
      }),
    );
    screen.getByRole("group", {
      name: /observations.actual: 13.0 GiB, observations.allocated: 15.0 GiB/,
    });
    expect(
      screen.getByRole("link", { name: /^instance:/ }).getAttribute("href"),
    ).toBe("/default/endpoints/show/instance");
    fireEvent.click(
      screen.getByRole("button", { name: "observations.details" }),
    );
    expect(screen.getByRole("dialog").textContent).toContain("gpu");
    expect(screen.getByRole("dialog").textContent).toContain("model");
    screen.getByText("extension-driver");
    expect(screen.queryByText("wrong-node")).toBeNull();
  });

  it("keeps replica usage unknown until measured while showing configured weights and cache", () => {
    const { rerender } = render(card({ replica: allocation }));
    screen.getByText("observations.noMeasurement");
    expect(screen.queryByText("13.0 GiB")).toBeNull();
    expect(
      screen.getByTestId("gpu-kv-weights-breakdown").textContent,
    ).toContain(
      "observations.modelWeights 2.0 GiB · observations.l0KvCache 8.0 GiB",
    );
    expect(screen.queryByText("observations.otherMemory")).toBeNull();
    rerender(
      card({
        replica: allocation,
        samples: [
          ...samples,
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            12 * 1024 ** 3,
            { endpoint: "instance", replica: "pod" },
          ),
        ],
      }),
    );
    screen.getByRole("group", { name: /observations.actual: 12.0 GiB/ });
    screen.getByText("observations.otherMemory");
    expect(screen.queryByText("observations.noMeasurement")).toBeNull();
  });

  it("shows shared-card allocations with unknown capacities and per-instance measurements", () => {
    const allocations = [
      {
        ...allocation,
        endpoint: "qwen-a",
        replica: "pod-a",
        instance: "pod-a",
        memoryMiB: 8192,
        kvCacheCapacityMiB: 4096,
      },
      {
        ...allocation,
        endpoint: "qwen-b",
        replica: "pod-b",
        instance: "pod-b",
        memoryMiB: 7168,
        modelWeightsMiB: undefined,
        kvCacheCapacityMiB: undefined,
      },
    ];
    const { rerender } = render(card({ allocations }));
    expect(
      screen.getByTestId("gpu-kv-weights-breakdown").textContent,
    ).toContain(
      "qwen-b observations.modelWeights — · observations.l0KvCache —",
    );
    expect(screen.queryByText("observations.otherMemory")).toBeNull();
    rerender(
      card({
        allocations,
        samples: [
          ...samples,
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            7 * 1024 ** 3,
            { endpoint: "qwen-a", replica: "pod-a" },
          ),
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            6 * 1024 ** 3,
            { endpoint: "qwen-b", replica: "pod-b" },
          ),
        ],
      }),
    );
    screen.getByRole("link", {
      name: "qwen-a: observations.actual 7.0 GiB, observations.allocated 8.0 GiB",
    });
    screen.getByRole("link", {
      name: "qwen-b: observations.actual 6.0 GiB, observations.allocated 7.0 GiB",
    });
    screen.getByText("observations.otherMemory");
  });
});
