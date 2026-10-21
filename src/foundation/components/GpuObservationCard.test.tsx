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
    expect(
      screen
        .getAllByRole("link", { name: /^instance:/ })[0]
        .getAttribute("href"),
    ).toBe("/default/endpoints/show/instance");
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
});
