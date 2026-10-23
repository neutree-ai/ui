import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AcceleratorSample } from "@/foundation/lib/accelerator-observations";
import { GpuObservationCard } from "./GpuObservationCard";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
afterEach(cleanup);
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
};
const samples: AcceleratorSample[] = [
  {
    metric: "neutree_accelerator_memory_used_bytes",
    labels: { node: "node", accelerator_uuid: "gpu" },
    value: 13 * 1024 ** 3,
    observed_at: Date.now() / 1000,
  },
];
describe("GPU observation card", () => {
  it("shows actual and allocated memory separately and opens details", () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <GpuObservationCard
            device={device}
            samples={samples}
            allocations={[allocation]}
          />
        </TooltipProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("group").getAttribute("aria-label")).toContain(
      "13.0 GiB",
    );
    expect(screen.getByRole("group").getAttribute("aria-label")).toContain(
      "15.0 GiB",
    );
    const allocationLink = screen.getAllByRole("link", {
      name: /^instance:/,
    })[0];
    expect(allocationLink.getAttribute("href")).toBe(
      "/default/endpoints/show/instance",
    );
    const measuredBar = allocationLink.querySelectorAll(
      "span",
    )[1] as HTMLElement;
    expect(Number.parseFloat(measuredBar.style.width)).toBeCloseTo(86.6667, 3);
    expect(measuredBar.style.backgroundColor).toBe("var(--nt-chart-series-1)");
    fireEvent.click(
      screen.getByRole("button", { name: "observations.details" }),
    );
    expect(screen.getByRole("dialog").textContent).toContain("gpu");
    expect(screen.getByRole("dialog").textContent).toContain("model");
  });
  it("does not display whole-card usage as replica usage", () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <GpuObservationCard
            device={device}
            samples={samples}
            allocations={[allocation]}
            replica={allocation}
          />
        </TooltipProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("observations.noMeasurement")).toBeTruthy();
    expect(screen.queryByText("13.0 GiB")).toBeNull();
  });
  const allocWithStats = {
    ...allocation,
    modelWeightsMiB: 2048,
    kvCacheCapacityMiB: 8192,
  };
  const renderCard = (
    props: Partial<Parameters<typeof GpuObservationCard>[0]>,
  ) =>
    render(
      <MemoryRouter>
        <TooltipProvider>
          <GpuObservationCard
            device={device}
            samples={samples}
            allocations={[allocWithStats]}
            {...props}
          />
        </TooltipProvider>
      </MemoryRouter>,
    );
  it("shows weights and L0 KV-Cache text but draws no segments without a replica measurement", () => {
    renderCard({ replica: allocWithStats });
    const breakdown = screen.getByTestId("gpu-kv-weights-breakdown");
    expect(breakdown.textContent).toContain(
      "observations.modelWeights 2.0 GiB",
    );
    expect(breakdown.textContent).toContain("observations.l0KvCache 8.0 GiB");
    expect(screen.getByText("observations.noMeasurement")).toBeTruthy();
    expect(screen.queryByTestId("gpu-bar-weights-segment")).toBeNull();
    expect(screen.queryByTestId("gpu-bar-kv-segment")).toBeNull();
    expect(screen.queryByTestId("gpu-bar-legend")).toBeNull();
  });
  it("draws weights, L0 KV-Cache and other segments inside the measured bar", () => {
    renderCard({
      replica: allocWithStats,
      samples: [
        {
          metric: "neutree_endpoint_replica_accelerator_memory_used_bytes",
          labels: {
            node: "node",
            accelerator_uuid: "gpu",
            endpoint: "instance",
            replica: "pod",
          },
          value: 12 * 1024 ** 3,
          observed_at: Date.now() / 1000,
        },
      ],
    });
    const width = (id: string) =>
      Number.parseFloat(screen.getByTestId(id).style.width);
    expect(width("gpu-bar-weights-segment")).toBeCloseTo(13.3333, 3);
    expect(width("gpu-bar-kv-segment")).toBeCloseTo(53.3333, 3);
    expect(width("gpu-bar-other-segment")).toBeCloseTo(13.3333, 3);
    expect(screen.getByTestId("gpu-bar-legend")).toBeTruthy();
  });
  it("shows a dash instead of the live usage ratio when the L0 pool size is unknown", () => {
    const noCapacity = { ...allocation, modelWeightsMiB: 2048 };
    renderCard({
      allocations: [noCapacity],
      replica: noCapacity,
      samples: [
        ...samples,
        {
          metric: "vllm:kv_cache_usage_perc",
          labels: { endpoint: "instance", replica: "pod" },
          value: 0.5,
          observed_at: Date.now() / 1000,
        },
      ],
    });
    const breakdown = screen.getByTestId("gpu-kv-weights-breakdown");
    expect(breakdown.textContent).toContain("observations.l0KvCache —");
    expect(breakdown.textContent).not.toContain("%");
  });
  it("lists each assigned instance with its name, weights, and L0 KV-Cache on the cluster view", () => {
    const allocA = {
      ...allocation,
      endpoint: "qwen-a",
      replica: "pod-a",
      instance: "pod-a",
      memoryMiB: 7680,
      modelWeightsMiB: 2048,
      kvCacheCapacityMiB: 4096,
    };
    const allocB = {
      ...allocation,
      endpoint: "qwen-b",
      replica: "pod-b",
      instance: "pod-b",
      memoryMiB: 7680,
    };
    renderCard({ allocations: [allocA, allocB] });
    const breakdown = screen.getByTestId("gpu-kv-weights-breakdown");
    expect(breakdown.textContent).toContain(
      "qwen-a observations.modelWeights 2.0 GiB · observations.l0KvCache 4.0 GiB",
    );
    expect(breakdown.textContent).toContain(
      "qwen-b observations.modelWeights — · observations.l0KvCache —",
    );
    expect(screen.queryByTestId("gpu-bar-weights-segment")).toBeNull();
  });
  it("draws per-instance composition segments when shared GPU replica measurements exist", () => {
    const allocA = {
      ...allocation,
      endpoint: "qwen-a",
      replica: "pod-a",
      instance: "pod-a",
      memoryMiB: 8192,
      modelWeightsMiB: 2048,
      kvCacheCapacityMiB: 4096,
    };
    const allocB = {
      ...allocation,
      endpoint: "qwen-b",
      replica: "pod-b",
      instance: "pod-b",
      memoryMiB: 7168,
      modelWeightsMiB: 1792,
      kvCacheCapacityMiB: 3584,
    };
    renderCard({
      allocations: [allocA, allocB],
      samples: [
        ...samples,
        {
          metric: "neutree_endpoint_replica_accelerator_memory_used_bytes",
          labels: {
            node: "node",
            accelerator_uuid: "gpu",
            endpoint: "qwen-a",
            replica: "pod-a",
          },
          value: 7 * 1024 ** 3,
          observed_at: Date.now() / 1000,
        },
        {
          metric: "neutree_endpoint_replica_accelerator_memory_used_bytes",
          labels: {
            node: "node",
            accelerator_uuid: "gpu",
            endpoint: "qwen-b",
            replica: "pod-b",
          },
          value: 6 * 1024 ** 3,
          observed_at: Date.now() / 1000,
        },
      ],
    });
    const weightSegments = screen.getAllByTestId("gpu-bar-weights-segment");
    const kvSegments = screen.getAllByTestId("gpu-bar-kv-segment");
    expect(weightSegments).toHaveLength(2);
    expect(kvSegments).toHaveLength(2);
    expect(Number.parseFloat(weightSegments[0].style.width)).toBeCloseTo(25, 3);
    expect(Number.parseFloat(kvSegments[0].style.width)).toBeCloseTo(50, 3);
    expect(Number.parseFloat(weightSegments[1].style.width)).toBeCloseTo(25, 3);
    expect(Number.parseFloat(kvSegments[1].style.width)).toBeCloseTo(50, 3);
  });
});
