import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EndpointRuntimeResourcesCard from "./EndpointRuntimeResourcesCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("EndpointRuntimeResourcesCard", () => {
  it("renders virtual allocated resource summary and replica groups", () => {
    const { container } = render(
      <EndpointRuntimeResourcesCard
        resources={{
          summary: {
            products: {
              "Tesla-T4": {
                memory_mib: 32768,
                core_units: 0,
              },
            },
          },
          replicas: [
            {
              instance_id: "endpoint-abc",
              replica_id: "endpoint-abc-xgpwv",
              node_id: "neutree-gpu-t4-02",
              devices: [
                {
                  uuid: "GPU-5ad72eb2-9871-1aba-55b8-ade03c41e56a",
                  product: "Tesla-T4",
                  memory_mib: 8192,
                  core_units: 0,
                  node_id: "neutree-gpu-t4-02",
                },
                {
                  uuid: "GPU-8bd1e3e9-7732-423a-a242-7c842f011b23",
                  product: "Tesla-T4",
                  memory_mib: 8192,
                  core_units: 0,
                  node_id: "neutree-gpu-t4-02",
                },
              ],
            },
            {
              instance_id: "endpoint-abc",
              replica_id: "endpoint-abc-rq2nl",
              node_id: "neutree-gpu-t4-03",
              devices: [
                {
                  uuid: "GPU-2f40471a-2afa-4b12-a1a8-c534c5a07190",
                  product: "Tesla-T4",
                  memory_mib: 8192,
                  core_units: 0,
                  node_id: "neutree-gpu-t4-03",
                },
                {
                  uuid: "GPU-c7907dc0-40f4-47dd-9dbb-6c3b63d60142",
                  product: "Tesla-T4",
                  memory_mib: 8192,
                  core_units: 0,
                  node_id: "neutree-gpu-t4-03",
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(container.firstElementChild?.className).toContain("border-t");
    expect(
      screen.getByText("endpoints.sections.allocatedResources"),
    ).toBeTruthy();
    expect(screen.getByText("2 replicas / 4 allocated cards")).toBeTruthy();
    expect(
      screen.getByText("endpoints.sections.replicaResources"),
    ).toBeTruthy();
    expect(screen.getAllByText("Tesla-T4")).toHaveLength(5);
    expect(screen.getByText("32.0 GiB")).toBeTruthy();
    expect(screen.getAllByText("16.0 GiB VRAM")).toHaveLength(2);
    expect(screen.getAllByText("2 cards")).toHaveLength(2);
    expect(screen.getAllByText("Core 0")).toHaveLength(2);
    expect(screen.getByText("endpoint-abc-xgpwv")).toBeTruthy();
    expect(screen.getByText("endpoint-abc-rq2nl")).toBeTruthy();
    expect(screen.getAllByText("GPU 0")).toHaveLength(2);
    expect(screen.getAllByText("GPU 1")).toHaveLength(2);
    expect(screen.getAllByText("8.0 GiB")).toHaveLength(4);
    expect(screen.getAllByText("neutree-gpu-t4-02")).toHaveLength(2);
    expect(screen.getAllByText("neutree-gpu-t4-03")).toHaveLength(2);
    expect(
      screen.getByText("GPU-c7907dc0-40f4-47dd-9dbb-6c3b63d60142"),
    ).toBeTruthy();
  });

  it("renders nothing when runtime resources are empty", () => {
    const { container } = render(
      <EndpointRuntimeResourcesCard resources={null} />,
    );
    expect(container.childElementCount).toBe(0);
  });

  it("renders allocated resources when status resources are present", () => {
    const { container } = render(
      <EndpointRuntimeResourcesCard
        resources={{
          summary: {
            products: {
              "Tesla-T4": {
                memory_mib: 15360,
                core_units: 100,
              },
            },
          },
          replicas: [
            {
              instance_id: "endpoint-abc",
              replica_id: "endpoint-abc-xgpwv",
              node_id: "neutree-gpu-t4-02",
              devices: [
                {
                  uuid: "GPU-5ad72eb2-9871-1aba-55b8-ade03c41e56a",
                  product: "Tesla-T4",
                  memory_mib: 15360,
                  core_units: 100,
                  node_id: "neutree-gpu-t4-02",
                },
              ],
            },
          ],
        }}
      />,
    );
    expect(container.firstElementChild?.className).toContain("border-t");
    expect(
      screen.getByText("endpoints.sections.allocatedResources"),
    ).toBeTruthy();
    expect(screen.getByText("1 replica / 1 allocated card")).toBeTruthy();
  });
});
