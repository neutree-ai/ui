import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  it("shows model weights and L0 KV-Cache usage when startup stats and vllm kv_cache_usage_perc are present", () => {
    const allocWithStats = {
      ...allocation,
      modelWeightsMiB: 6144,
      kvCacheCapacityMiB: 8192,
    };
    const kvSamples: AcceleratorSample[] = [
      ...samples,
      {
        metric: "vllm:kv_cache_usage_perc",
        labels: { endpoint: "instance", replica: "pod" },
        value: 0.5,
        observed_at: Date.now() / 1000,
      },
    ];
    render(
      <MemoryRouter>
        <TooltipProvider>
          <GpuObservationCard
            device={device}
            samples={kvSamples}
            allocations={[allocWithStats]}
            replica={allocWithStats}
          />
        </TooltipProvider>
      </MemoryRouter>,
    );
    const breakdown = screen.getByTestId("gpu-kv-weights-breakdown");
    expect(breakdown.textContent).toContain(
      "observations.modelWeights 6.0 GiB",
    );
    expect(breakdown.textContent).toContain(
      "observations.l0KvCache ≈4.0 GiB / 8.0 GiB",
    );
  });
});
