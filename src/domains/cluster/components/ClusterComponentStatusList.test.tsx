import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClusterComponentStatusList } from "./ClusterComponentStatusList";

const t = (key: string, options?: { defaultValue?: string }) =>
  options?.defaultValue ?? key;

describe("ClusterComponentStatusList", () => {
  it("renders every component status as a separate row", () => {
    render(
      <ClusterComponentStatusList
        componentStatus={{
          accelerator_virtualization: {
            phase: "Ready",
            managed: true,
            version: "v2.9.0",
            reason: "Ready",
            message: "accelerator virtualization component is ready",
          },
          router: {
            phase: "Pending",
            managed: false,
            version: "v1.0.1",
            reason: "Installing",
            message: "Router deployment is progressing",
          },
        }}
        t={t}
      />,
    );

    expect(screen.getByText("clusters.sections.componentStatus")).toBeTruthy();
    expect(screen.queryByText("accelerator_virtualization")).toBeNull();
    expect(screen.getByText("Accelerator Virtualization")).toBeTruthy();
    expect(screen.getByText("router")).toBeTruthy();
    expect(screen.getAllByText("Ready").length).toBeGreaterThan(0);
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText("v2.9.0")).toBeTruthy();
    expect(screen.getByText("v1.0.1")).toBeTruthy();
    expect(
      screen.getByText("accelerator virtualization component is ready"),
    ).toBeTruthy();
    expect(screen.getByText("Router deployment is progressing")).toBeTruthy();
  });
});
