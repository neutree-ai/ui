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

  it("reports pooled usage as unknown when a product omits availability", () => {
    render(
      <ClusterResourceSummary
        resourceInfo={{
          allocatable: {
            cpu: 16,
            memory: 64,
            accelerator_groups: {
              nvidia_gpu: {
                quantity: 4,
                product_groups: null,
                products: {
                  "Tesla-T4": {
                    quantity: 2,
                    virtualization: {
                      memory_mib: 30 * 1024,
                      core_units: 200,
                    },
                  },
                  "NVIDIA-L20": {
                    quantity: 2,
                    virtualization: {
                      memory_mib: 40 * 1024,
                      core_units: 100,
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
        }}
        t={t}
      />,
    );

    // The whole pool is unknown rather than the T4 share standing in for it,
    // which would have read as the L20 cards being fully consumed.
    expect(screen.getByText("- / 70.0")).toBeTruthy();
    expect(screen.getByText("- / 300")).toBeTruthy();

    const progressBars = screen.getAllByRole("progressbar");
    expect(progressBars[2].className).toContain("border-dashed");
    expect(progressBars[3].className).toContain("border-dashed");
  });

  it("reports card allocation as unknown when the type omits availability", () => {
    render(
      <ClusterResourceSummary
        resourceInfo={{
          allocatable: {
            cpu: 4,
            memory: 8,
            accelerator_groups: {
              nvidia_gpu: {
                quantity: 2,
                product_groups: null,
                products: null,
              },
            },
          },
          available: null,
          node_resources: null,
        }}
        t={t}
      />,
    );

    const cardBar = screen.getByRole("img", { name: "GPU Cards: - / 2" });
    expect(cardBar.children).toHaveLength(2);
    for (const segment of cardBar.children) {
      expect(segment.className).toContain("bg-muted");
    }
  });

  it("treats an omitted quantity in an existing availability group as zero", () => {
    render(
      <ClusterResourceSummary
        resourceInfo={
          {
            allocatable: {
              cpu: 4,
              memory: 8,
              accelerator_groups: {
                nvidia_gpu: {
                  quantity: 1,
                  product_groups: null,
                  products: null,
                },
              },
            },
            available: {
              cpu: 4,
              memory: 8,
              accelerator_groups: {
                nvidia_gpu: {
                  product_groups: null,
                  products: null,
                },
              },
            },
            node_resources: null,
          } as unknown as ClusterResourceInfo
        }
        t={t}
      />,
    );

    expect(screen.getByText("1 / 1")).toBeTruthy();
    expect(screen.getByText("100% allocated")).toBeTruthy();
    expect(screen.getByText("0 cards")).toBeTruthy();
  });

  it("displays fractional card allocation with decimal precision", () => {
    render(
      <ClusterResourceSummary
        resourceInfo={{
          ...resourceInfo,
          available: {
            ...resourceInfo.available!,
            accelerator_groups: {
              nvidia_gpu: {
                ...resourceInfo.available!.accelerator_groups!.nvidia_gpu,
                quantity: 1.5,
              },
            },
          },
        }}
        t={t}
      />,
    );

    expect(screen.getByText("0.5 / 2.0")).toBeTruthy();
    expect(screen.getByText("25% allocated")).toBeTruthy();
    expect(screen.getByText("1.5 cards")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /GPU Cards/ })).toBeNull();
    expect(
      screen.getByRole("progressbar", { name: "GPU Cards: 0.5 / 2.0" }),
    ).toBeTruthy();
  });

  it("keeps the meter continuous when fractional groups sum to an integer", () => {
    render(
      <ClusterResourceSummary
        resourceInfo={{
          allocatable: {
            cpu: 4,
            memory: 8,
            accelerator_groups: {
              nvidia_gpu: {
                quantity: 0.5,
                product_groups: null,
                products: null,
              },
              npu: {
                quantity: 0.5,
                product_groups: null,
                products: null,
              },
            },
          },
          available: {
            cpu: 4,
            memory: 8,
            accelerator_groups: {
              nvidia_gpu: {
                quantity: 0.5,
                product_groups: null,
                products: null,
              },
              npu: {
                quantity: 0.5,
                product_groups: null,
                products: null,
              },
            },
          },
          node_resources: null,
        }}
        t={t}
      />,
    );

    expect(screen.getByText("0.0 / 1.0")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /GPU Cards/ })).toBeNull();
    expect(
      screen.getByRole("progressbar", { name: "GPU Cards: 0.0 / 1.0" }),
    ).toBeTruthy();
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
