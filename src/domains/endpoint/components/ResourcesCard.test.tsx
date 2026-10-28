import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ResourceSpec } from "@/foundation/types/serving-types";
import ResourcesCard from "./ResourcesCard";

vi.mock("@/foundation/components/ShowPage", () => ({
  ShowPage: {
    Row: ({ title, children }: { title: string; children: ReactNode }) => (
      <div>
        <dt>{title}</dt>
        <dd>{children}</dd>
      </div>
    ),
  },
}));

describe("ResourcesCard", () => {
  it("does not append a percent sign when vGPU core percent is unset", () => {
    render(
      <ResourcesCard
        resources={
          {
            cpu: 2,
            memory: 8,
            gpu: 1,
            accelerator: {
              type: "nvidia_gpu",
              product: "Tesla-T4",
              virtualization: {
                memory_mib: 8192,
              },
            },
          } as ResourceSpec
        }
      />,
    );

    screen.getByText("endpoints.fields.vgpuCorePercent");
    screen.getByText("8.0 GiB");
    screen.getByText("-");
    expect(screen.queryByText("-%")).toBeNull();
  });

  it("renders vGPU core percent as a plain number when configured", () => {
    render(
      <ResourcesCard
        resources={
          {
            cpu: 2,
            memory: 8,
            gpu: 1,
            accelerator: {
              type: "nvidia_gpu",
              product: "Tesla-T4",
              virtualization: {
                memory_mib: 8192,
                core_percent: 50,
              },
            },
          } as ResourceSpec
        }
      />,
    );

    screen.getByText("50");
    expect(screen.queryByText("50%")).toBeNull();
    screen.getByText("8.0 GiB");
  });
});
