import {
  fireEvent,
  render as renderUI,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeAcceleratorSample,
  makeGpuDevice,
} from "@/foundation/testing/resource-builders";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";
import EndpointRuntimeResourcesCard, {
  EndpointRuntimeResourcesSummary,
} from "./EndpointRuntimeResourcesCard";

const render = (ui: ReactNode) => renderUI(ui, { wrapper: MemoryRouter });

type RuntimeResources = NonNullable<
  ComponentProps<typeof EndpointRuntimeResourcesCard>["resources"]
>;
type Replica = NonNullable<RuntimeResources["replicas"]>[number];
type Device = NonNullable<Replica["devices"]>[number];

const copyMock = vi.fn();
vi.mock("@/foundation/hooks/use-copy-to-clipboard", () => ({
  useCopyToClipboard: () => ({
    copy: copyMock,
    copied: false,
  }),
}));

// A replica's share of a Tesla-T4 card on its node.
const makeDevice = (overrides: Partial<Device> = {}): Device => ({
  ...makeGpuDevice(
    "GPU-t4-01",
    { memory_mib: 76288, core_units: 65 },
    { order: 1, allocatable: { memory_mib: 81920, core_units: 100 } },
  ),
  memory_mib: 8192,
  core_units: 35,
  node_id: "gpu-node-01",
  ...overrides,
});

const makeReplica = (overrides: Partial<Replica> = {}): Replica => ({
  instance_id: "endpoint-abc",
  replica_id: "endpoint-abc-0",
  node_id: "gpu-node-01",
  model_weights_mib: 2048,
  kv_cache_capacity_mib: 4096,
  devices: [makeDevice()],
  ...overrides,
});

const withReplicas = (...replicas: Replica[]): RuntimeResources => ({
  summary: null,
  replicas,
});

const deviceLabels = (node: string, uuid: string) => ({
  node,
  accelerator_uuid: uuid,
  endpoint: "endpoint-abc",
  instance_id: "endpoint-abc",
  replica: "endpoint-abc-0",
});

describe("EndpointRuntimeResourcesCard", () => {
  beforeEach(() => {
    copyMock.mockClear();
  });

  it("uses the same compact device rows for single and multi-node replicas", () => {
    const devicesOn = (node: string, uuids: string[]) =>
      uuids.map((uuid, index) =>
        makeDevice({ uuid, order: index + 1, node_id: node }),
      );

    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        workspace="default"
        requestedResources={{
          cpu: 12,
          memory: 48,
          gpu: 2,
          accelerator: { type: "nvidia_gpu", product: "Tesla-T4" },
        }}
        resources={withReplicas(
          makeReplica({
            replica_id: "endpoint-abc-single-node",
            devices: devicesOn("gpu-node-01", ["GPU-t4-01", "GPU-t4-02"]),
          }),
          makeReplica({
            replica_id: "endpoint-abc-multi-node",
            node_id: "gpu-node-02",
            devices: [
              ...devicesOn("gpu-node-02", ["GPU-t4-11", "GPU-t4-12"]),
              ...devicesOn("gpu-node-03", ["GPU-t4-21", "GPU-t4-22"]),
            ],
          }),
        )}
      />,
    );

    expect(screen.getAllByTestId("runtime-replica")).toHaveLength(2);
    expect(screen.getAllByTestId("gpu-allocation-row")).toHaveLength(6);
    screen.getByText("common.fields.replica 0");
    screen.getByText("common.fields.replica 1");
    screen.getByText("endpoint-abc-single-node");
    screen.getByText("endpoint-abc-multi-node");
    screen.getByText("endpoints.fields.crossNodes:2");
    screen.getByText("gpu-node-01");
    screen.getByText("gpu-node-02");
    screen.getByText("gpu-node-03");

    const [firstRow] = screen.getAllByTestId("gpu-allocation-row");
    expect(firstRow.textContent).toContain("observations.noMeasurement");
    expect(firstRow.textContent).toContain("observations.modelWeights 2.0 GiB");
    expect(firstRow.textContent).toContain("observations.l0KvCache 4.0 GiB");
    expect(firstRow.textContent).toContain("35%");
  });

  it("summarizes measured VRAM, utilization and configured L0 cache", () => {
    const devices = [0, 1, 2, 3].map((index) =>
      makeDevice({
        uuid: `GPU-${index}`,
        order: index,
        memory_mib: 16 * 1024,
      }),
    );
    const utilization = [0.5, 0.75, 0.25, 0.5];
    const memory = [10, 10, 10, 10];

    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        workspace="default"
        resources={withReplicas(
          makeReplica({
            kv_cache_capacity_mib: 8 * 1024,
            devices,
          }),
        )}
        samples={devices.flatMap((device, index) => {
          const labels = deviceLabels(device.node_id ?? "", device.uuid);
          return [
            makeAcceleratorSample(
              "neutree_endpoint_replica_accelerator_memory_used_bytes",
              memory[index] * 1024 ** 3,
              labels,
            ),
            makeAcceleratorSample(
              "neutree_endpoint_replica_accelerator_utilization_ratio",
              utilization[index],
              labels,
            ),
          ];
        })}
      />,
    );

    const replica = screen.getByTestId("runtime-replica");
    within(replica).getByText("observations.reservedVram");
    within(replica).getByText("64.0 GiB");
    within(replica).getByText("40.0 GiB / 64.0 GiB");
    expect(within(replica).getAllByText("50%")).toHaveLength(3);
    within(replica).getByText("observations.averagePeak:75");
    within(replica).getByText("32.0 GiB");
    within(replica).getByText("observations.acrossGpus:4");
  });

  it("uses cluster metadata for physical VRAM and requested vGPU compute share", () => {
    const clusterResourceInfo: ClusterResourceInfo = {
      allocatable: null,
      available: null,
      node_resources: null,
      accelerator_metadata: {
        nvidia_gpu: {
          products: { "Tesla-T4": { memory_total_mib: 15 * 1024 } },
        },
      },
    };
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        workspace="default"
        clusterResourceInfo={clusterResourceInfo}
        requestedResources={{
          cpu: 12,
          memory: 48,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "Tesla-T4",
            virtualization: { memory_mib: 8192, core_percent: 50 },
          },
        }}
        resources={withReplicas(
          makeReplica({
            devices: [
              makeDevice({
                core_units: 0,
                allocatable: undefined,
                available: undefined,
              }),
            ],
          }),
        )}
      />,
    );

    const row = screen.getByTestId("gpu-allocation-row");
    expect(row.textContent).toContain("50%");
    fireEvent.click(
      within(row).getByRole("button", {
        name: "observations.detailsForGpu:1",
      }),
    );
    expect(screen.getByRole("dialog").textContent).toContain("GPU-t4-01");
  });

  it("copies a GPU UUID from the shared row action", () => {
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        workspace="default"
        resources={withReplicas(makeReplica())}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "clusters.fields.gpuNumber 1 clusters.actions.copyUuid",
      }),
    );
    expect(copyMock).toHaveBeenCalledWith("GPU-t4-01", expect.any(Object));
  });

  it("renders replica and allocated card counts outside the surface", () => {
    render(
      <EndpointRuntimeResourcesSummary
        resources={withReplicas(
          makeReplica(),
          makeReplica({ replica_id: "endpoint-abc-1" }),
        )}
      />,
    );

    screen.getByText(
      "endpoints.fields.replicaCount:2 / endpoints.fields.allocatedCardCount:2",
    );
  });

  it("renders nothing when runtime resources are empty", () => {
    const { container } = render(
      <EndpointRuntimeResourcesCard resources={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a product summary when replicas are not available", () => {
    render(
      <EndpointRuntimeResourcesCard
        resources={{
          summary: {
            products: { "Tesla-T4": { memory_mib: 30720, core_units: 0 } },
          },
          replicas: [],
        }}
      />,
    );

    const summary = screen.getByTestId("runtime-resource-summary");
    within(summary).getByText("Tesla-T4");
    within(summary).getByText("30.0 GiB");
  });
});
