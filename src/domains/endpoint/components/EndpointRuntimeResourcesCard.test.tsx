import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EndpointRuntimeResourcesCard from "./EndpointRuntimeResourcesCard";

const copyMock = vi.fn();
const translations: Record<string, string> = {
  "clusters.actions.copyUuid": "Copy UUID",
  "clusters.fields.gpuNumber": "GPU",
  "endpoints.fields.allocatedCard": "allocated card",
  "endpoints.fields.allocatedCards": "allocated cards",
  "endpoints.fields.card": "card",
  "endpoints.fields.cards": "cards",
  "endpoints.fields.replicaUnit": "replica",
  "endpoints.fields.replicaUnits": "replicas",
  "endpoints.fields.vgpuCoreCapacity": "Core",
  "endpoints.fields.vgpuMemory": "VRAM",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}));

vi.mock("@/foundation/hooks/use-copy-to-clipboard", () => ({
  useCopyToClipboard: () => ({
    copy: copyMock,
    copied: false,
  }),
}));

describe("EndpointRuntimeResourcesCard", () => {
  beforeEach(() => {
    copyMock.mockClear();
  });

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
    expect(screen.getAllByText("Core -")).toHaveLength(2);
    expect(screen.queryByText("Core 0")).toBeNull();
    expect(screen.getByText("endpoint-abc-xgpwv")).toBeTruthy();
    expect(screen.getByText("endpoint-abc-rq2nl")).toBeTruthy();
    expect(screen.getAllByText("GPU 1")).toHaveLength(2);
    expect(screen.getAllByText("GPU 2")).toHaveLength(2);
    expect(screen.getAllByText("8.0 GiB")).toHaveLength(4);
    expect(screen.getAllByText("neutree-gpu-t4-02")).toHaveLength(2);
    expect(screen.getAllByText("neutree-gpu-t4-03")).toHaveLength(2);
    expect(
      screen.queryByText("GPU-c7907dc0-40f4-47dd-9dbb-6c3b63d60142"),
    ).toBeNull();
    expect(
      screen.queryByTitle("GPU-c7907dc0-40f4-47dd-9dbb-6c3b63d60142"),
    ).toBeNull();
    const gpuOneCopyButtons = screen.getAllByRole("button", {
      name: "GPU 2 Copy UUID",
    });
    fireEvent.click(gpuOneCopyButtons[1]);
    expect(copyMock).toHaveBeenCalledWith(
      "GPU-c7907dc0-40f4-47dd-9dbb-6c3b63d60142",
      expect.any(Object),
    );
  });

  it("renders nothing when runtime resources are empty", () => {
    const { container } = render(
      <EndpointRuntimeResourcesCard resources={null} />,
    );
    expect(container.childElementCount).toBe(0);
  });

  it("renders allocated replica resources for full-card resources", () => {
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
    expect(container.childElementCount).toBe(1);
    expect(
      screen.getByText("endpoints.sections.allocatedResources"),
    ).toBeTruthy();
    expect(
      screen.getByText("endpoints.sections.replicaResources"),
    ).toBeTruthy();
    expect(screen.getByText("1 replica / 1 allocated card")).toBeTruthy();
    expect(screen.getByText("endpoint-abc-xgpwv")).toBeTruthy();
    expect(screen.getAllByText("Tesla-T4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("15.0 GiB").length).toBeGreaterThan(0);
    expect(screen.getByText("Core 100")).toBeTruthy();
    expect(screen.getAllByText("neutree-gpu-t4-02").length).toBeGreaterThan(0);
    expect(
      screen.queryByText("GPU-5ad72eb2-9871-1aba-55b8-ade03c41e56a"),
    ).toBeNull();
    expect(
      screen.queryByTitle("GPU-5ad72eb2-9871-1aba-55b8-ade03c41e56a"),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "GPU 1 Copy UUID",
      }),
    );
    expect(copyMock).toHaveBeenCalledWith(
      "GPU-5ad72eb2-9871-1aba-55b8-ade03c41e56a",
      expect.any(Object),
    );
  });

  it("renders replica GPU labels in physical order when order is provided", () => {
    render(
      <EndpointRuntimeResourcesCard
        resources={{
          summary: null,
          replicas: [
            {
              instance_id: "endpoint-ordered",
              replica_id: "endpoint-ordered-0",
              node_id: "node-a",
              devices: [
                {
                  uuid: "GPU-node-a-bbbbbbbb",
                  order: 1,
                  product: "Tesla-T4",
                  memory_mib: 8192,
                  core_units: 0,
                  node_id: "node-a",
                },
                {
                  uuid: "GPU-node-a-aaaaaaaa",
                  order: 0,
                  product: "Tesla-T4",
                  memory_mib: 8192,
                  core_units: 0,
                  node_id: "node-a",
                },
              ],
            },
          ],
        }}
      />,
    );

    const gpuButtons = screen.getAllByRole("button", {
      name: /GPU \d Copy UUID/,
    });
    expect(gpuButtons.map((button) => button.textContent)).toEqual([
      "GPU 0Copy UUID",
      "GPU 1Copy UUID",
    ]);
    fireEvent.click(gpuButtons[0]);
    expect(copyMock).toHaveBeenCalledWith(
      "GPU-node-a-aaaaaaaa",
      expect.any(Object),
    );
  });

  it("shows static split allocated VRAM totals and hides unconfigured core limits", () => {
    render(
      <EndpointRuntimeResourcesCard
        resources={{
          summary: {
            products: {
              "Tesla-T4": {
                memory_mib: 30720,
                core_units: 0,
              },
            },
          },
          replicas: [
            {
              instance_id: "endpoint-static",
              replica_id: "endpoint-static-0",
              node_id: "node-a",
              devices: [
                {
                  uuid: "GPU-static-a",
                  product: "Tesla-T4",
                  memory_mib: 15360,
                  core_units: 0,
                  node_id: "node-a",
                },
                {
                  uuid: "GPU-static-b",
                  product: "Tesla-T4",
                  memory_mib: 15360,
                  core_units: 0,
                  node_id: "node-a",
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("30.0 GiB")).toBeTruthy();
    expect(screen.getByText("30.0 GiB VRAM")).toBeTruthy();
    expect(screen.getByText("Core -")).toBeTruthy();
    expect(screen.queryByText("Core 0")).toBeNull();
    expect(screen.queryByText("GPU-static-a")).toBeNull();
    expect(screen.queryByTitle("GPU-static-a")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "GPU 1 Copy UUID",
      }),
    );
    expect(copyMock).toHaveBeenCalledWith("GPU-static-a", expect.any(Object));
  });
});
