import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ResourceSpec } from "@/foundation/types/serving-types";
import ResourcesCard from "./ResourcesCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

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

    expect(screen.getByText("endpoints.fields.vgpuCorePercent")).toBeTruthy();
    expect(screen.getByText("8.0 GiB")).toBeTruthy();
    expect(screen.getByText("-")).toBeTruthy();
    expect(screen.queryByText("-%")).toBeNull();
  });

  it("renders a percent sign when vGPU core percent is configured", () => {
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

    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("8.0 GiB")).toBeTruthy();
  });
});
