import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";
import { ClusterResourceSummary } from "./ClusterResourceSummary";

const labels: Record<string, string> = {
  "common.fields.cpu": "CPU",
  "common.fields.memory": "Memory",
  "clusters.fields.physicalGpu": "GPU Cards",
  "clusters.fields.memoryUsage": "VRAM",
  "clusters.fields.coreUsage": "Core",
  "clusters.options.allocated": "Allocated",
  "clusters.options.used": "Used",
  "clusters.options.free": "Free",
};

const t = (key: string) => labels[key] ?? key;

const resourceInfo: ClusterResourceInfo = {
  allocatable: {
    cpu: 16,
    memory: 64,
    accelerator_groups: {
      nvidia_gpu: {
        quantity: 2,
        product_groups: null,
        products: {
          "Tesla-T4": {
            quantity: 2,
            virtualization: {
              memory_mib: 30 * 1024,
              core_units: 200,
            },
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
            virtualization: {
              memory_mib: 10 * 1024,
              core_units: 50,
            },
          },
        },
      },
    },
  },
  node_resources: null,
};

describe("ClusterResourceSummary", () => {
  it("does not render without allocatable resources", () => {
    const { container } = render(
      <ClusterResourceSummary
        resourceInfo={{
          allocatable: null,
          available: null,
          node_resources: null,
        }}
        t={t}
      />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("summarizes compute and accelerator allocation", () => {
    render(<ClusterResourceSummary resourceInfo={resourceInfo} t={t} />);

    expect(screen.getByText("CPU")).toBeTruthy();
    expect(screen.getByText("4.0 / 16.0")).toBeTruthy();
    expect(screen.getAllByText("25% used")).toHaveLength(2);
    expect(screen.getByText("Memory")).toBeTruthy();
    expect(screen.getByText("16.0 / 64.0")).toBeTruthy();

    const cardBar = screen.getByRole("img", {
      name: "GPU Cards: 1 / 2",
    });
    expect(cardBar.children).toHaveLength(2);
    expect(cardBar.children[0].className).toContain("--nt-chart-series-5");
    expect(cardBar.children[1].className).toContain("bg-muted");

    expect(screen.getByText("20.0 / 30.0")).toBeTruthy();
    expect(screen.getByText("67% used")).toBeTruthy();
    expect(screen.getByText("150 / 200")).toBeTruthy();
    expect(screen.getByText("75% used")).toBeTruthy();

    const progressBars = screen.getAllByRole("progressbar");
    expect(progressBars).toHaveLength(4);
    expect(progressBars[0].className).toContain("--nt-chart-series-4");
    expect(progressBars[1].className).toContain("--nt-chart-series-3");
    expect(progressBars[2].className).toContain("--nt-chart-series-1");
    expect(progressBars[3].className).toContain("--nt-chart-series-2");
  });

  it("hides accelerator metrics when the cluster has no cards", () => {
    render(
      <ClusterResourceSummary
        resourceInfo={{
          allocatable: {
            cpu: 4,
            memory: 8,
            accelerator_groups: null,
          },
          available: null,
          node_resources: null,
        }}
        t={t}
      />,
    );

    expect(screen.queryByText("GPU Cards")).toBeNull();
    expect(screen.queryByText("VRAM")).toBeNull();
    expect(screen.queryByText("Core")).toBeNull();
  });
});
