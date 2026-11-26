import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, it, vi } from "vitest";
import type { ResourceSpec } from "@/foundation/types/serving-types";
import ResourcesCard from "./ResourcesCard";

vi.mock("@/foundation/scene/ShowPage", () => ({
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
  it("shows the requested resources and vGPU limits", () => {
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

    for (const text of ["2.0", "8.0", "Tesla-T4", "8.0 GiB", "50"]) {
      screen.getByText(text);
    }
  });
});
