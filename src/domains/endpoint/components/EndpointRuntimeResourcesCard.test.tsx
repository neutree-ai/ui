import {
  fireEvent,
  render as renderUI,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AcceleratorSample } from "@/foundation/lib/accelerator-observations";
import type {
  ClusterResourceInfo,
  EndpointResourceStatus,
} from "@/foundation/types/resource-types";
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

const makeDevice = (overrides: Partial<Device> = {}): Device => ({
  uuid: "GPU-t4-01",
  order: 1,
  product: "Tesla-T4",
  memory_mib: 8192,
  core_units: 35,
  node_id: "gpu-node-01",
  allocatable: { memory_mib: 81920, core_units: 100 },
  available: { memory_mib: 76288, core_units: 65 },
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

const withReplicas = (...replicas: Replica[]): EndpointResourceStatus => ({
  summary: null,
  replicas,
});

const sample = (
  metric: string,
  value: number,
  labels: Record<string, string>,
): AcceleratorSample => ({
  metric,
  value,
  observed_at: 1,
  labels,
});

const deviceLabels = (node: string, uuid: string) => ({
  node,
  accelerator_uuid: uuid,
});

const endpointLabels = (
  node: string,
  uuid: string,
  replica = "endpoint-abc-0",
  instance = "endpoint-abc",
) => ({
  ...deviceLabels(node, uuid),
  endpoint: "endpoint-abc",
  replica,
  instance_id: instance,
});

describe("EndpointRuntimeResourcesCard", () => {
  beforeEach(() => {
    copyMock.mockClear();
  });

  it("groups shared Replica allocations under one physical GPU", () => {
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(
          makeReplica(),
          makeReplica({
            replica_id: "endpoint-abc-1",
            devices: [makeDevice()],
          }),
        )}
      />,
    );

    expect(screen.getAllByTestId("runtime-gpu-card")).toHaveLength(1);
    expect(
      screen.getAllByRole("button", {
        name: /observations\.replicaLabel/,
      }),
    ).toHaveLength(2);
    screen.getByText(
      "endpoints.fields.replicaCount:2 / endpoints.fields.allocatedCardCount:1",
    );
    screen.getByText("endpoints.sections.runtimeAllocation");
    screen.getByText("gpu-node-01");
  });

  it("keeps multi-replica bars reserved-only until hover adds usage and details", async () => {
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(
          makeReplica({
            model_weights_mib: null,
            kv_cache_capacity_mib: null,
          }),
          makeReplica({
            replica_id: "endpoint-abc-1",
            model_weights_mib: null,
            kv_cache_capacity_mib: null,
            devices: [makeDevice()],
          }),
        )}
        samples={[
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            6 * 1024 ** 3,
            endpointLabels("gpu-node-01", "GPU-t4-01"),
          ),
        ]}
      />,
    );

    expect(screen.queryByTestId("single-allocation-legend")).toBeNull();

    const replica = screen.getAllByRole("button", {
      name: /observations\.replicaLabel/,
    })[0];
    fireEvent.focus(replica);
    const tooltip = await screen.findByRole("tooltip");
    within(tooltip).getByText("observations.actualVramUsage");
    expect(tooltip.textContent).toContain("6.0 GiB");
  });

  it("shows an aggregate strip only when multiple physical GPUs are present", () => {
    const { unmount } = render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(makeReplica())}
      />,
    );
    expect(screen.queryByTestId("runtime-summary")).toBeNull();

    unmount();
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(
          makeReplica({
            devices: [
              makeDevice({ uuid: "GPU-1", order: 1 }),
              makeDevice({ uuid: "GPU-2", order: 2 }),
            ],
          }),
        )}
      />,
    );
    within(screen.getByTestId("runtime-summary")).getByText(
      "observations.reservedVram",
    );
  });

  it("uses cluster metadata for health and opens the shared GPU details", () => {
    const clusterResourceInfo: ClusterResourceInfo = {
      allocatable: null,
      available: null,
      accelerator_metadata: null,
      node_resources: {
        "gpu-node-01": {
          allocatable: null,
          available: null,
          devices: [
            {
              uuid: "GPU-t4-01",
              product: "Tesla-T4",
              health: true,
            },
          ],
        },
      },
    };
    render(
      <EndpointRuntimeResourcesCard
        clusterResourceInfo={clusterResourceInfo}
        endpointName="endpoint-abc"
        resources={withReplicas(makeReplica())}
      />,
    );

    screen.getByText("clusters.options.healthy");
    const card = screen.getByTestId("runtime-gpu-card");
    within(card).getByRole("button", {
      name: "observations.detailsForGpu:1",
    });
    fireEvent.pointerDown(card, { button: 0 });
    expect(screen.getByRole("dialog").textContent).toContain("GPU-t4-01");
  });

  it("keeps allocation data visible when the GPU is unhealthy", () => {
    render(
      <EndpointRuntimeResourcesCard
        clusterResourceInfo={{
          allocatable: null,
          available: null,
          accelerator_metadata: null,
          node_resources: {
            "gpu-node-01": {
              allocatable: null,
              available: null,
              devices: [
                {
                  uuid: "GPU-t4-01",
                  product: "Tesla-T4",
                  health: false,
                },
              ],
            },
          },
        }}
        endpointName="endpoint-abc"
        resources={withReplicas(makeReplica())}
      />,
    );

    const card = screen.getByTestId("runtime-gpu-card");
    within(card).getByText("clusters.options.unhealthy");
    within(card).getByText("observations.reservedOfPhysical:8.0,80.0");
  });

  it("does not invent a physical scale when physical VRAM is unknown", () => {
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(
          makeReplica({
            devices: [
              makeDevice({
                allocatable: undefined,
              }),
            ],
          }),
        )}
      />,
    );

    const card = screen.getByTestId("runtime-gpu-card");
    within(card).getByText("observations.physicalVramUnavailable");
    within(card).getByText("observations.reservedOfPhysical:8.0,—");
  });

  it("shows every Endpoint sharing the opened physical GPU", () => {
    const currentDevice = makeDevice({
      memory_mib: 16 * 1024,
      core_units: 25,
    });
    const sharedAllocation = (endpoint: string, replica: string) => ({
      endpoint,
      workspace: "design-lab",
      model: `${endpoint}-model`,
      node: "gpu-node-01",
      uuid: "GPU-t4-01",
      replica,
      instance: `${endpoint}-0`,
      memoryMiB: 16 * 1024,
      coreUnits: 25,
      modelWeightsMiB: 10 * 1024,
      kvCacheCapacityMiB: 2 * 1024,
    });
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        workspace="design-lab"
        gpuAllocations={[
          sharedAllocation("endpoint-abc", "R0"),
          sharedAllocation("endpoint-beta", "R1"),
          sharedAllocation("endpoint-gamma", "R2"),
          sharedAllocation("endpoint-delta", "R3"),
        ]}
        resources={withReplicas(makeReplica({ devices: [currentDevice] }))}
        samples={[
          sample(
            "neutree_accelerator_memory_used_bytes",
            30 * 1024 ** 2,
            deviceLabels("gpu-node-01", "GPU-t4-01"),
          ),
          sample(
            "neutree_accelerator_utilization_ratio",
            0.58,
            deviceLabels("gpu-node-01", "GPU-t4-01"),
          ),
        ]}
      />,
    );

    const card = screen.getByTestId("runtime-gpu-card");
    expect(card.textContent).not.toContain("endpoint-beta");
    expect(card.textContent).not.toContain("endpoint-gamma");

    fireEvent.pointerDown(card, { button: 0 });

    const dialog = screen.getByRole("dialog");
    within(dialog).getAllByText("endpoint-beta");
    within(dialog).getAllByText("endpoint-gamma");
    within(dialog).getAllByText("endpoint-delta");
    within(dialog).getByText("observations.endpointCount:4");
    within(dialog).getByText("observations.allocated 64.0 / 80.0 GiB");
  });

  it("hides other Endpoint reservations that exceed physical GPU capacity", () => {
    const currentDevice = makeDevice({
      memory_mib: 45 * 1024,
      allocatable: { memory_mib: 45 * 1024, core_units: 100 },
    });
    const otherAllocation = {
      endpoint: "endpoint-beta",
      workspace: "design-lab",
      model: "endpoint-beta-model",
      node: "gpu-node-01",
      uuid: "GPU-t4-01",
      replica: "endpoint-beta-0",
      instance: "endpoint-beta",
      memoryMiB: 22 * 1024,
    };

    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        workspace="design-lab"
        gpuAllocations={[otherAllocation]}
        resources={withReplicas(makeReplica({ devices: [currentDevice] }))}
      />,
    );

    screen.getByText("observations.allocationInconsistent");
    expect(screen.queryByTestId("other-endpoints-segment")).toBeNull();
    expect(screen.queryByText("observations.otherEndpoints")).toBeNull();
    screen.getByTestId("single-replica-composition");

    fireEvent.pointerDown(screen.getByTestId("runtime-gpu-card"), {
      button: 0,
    });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText("endpoint-beta")).toBeNull();
  });

  it("keeps UUID and allocation actions from opening the card details", () => {
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(
          makeReplica(),
          makeReplica({
            replica_id: "endpoint-abc-1",
            devices: [makeDevice()],
          }),
        )}
      />,
    );

    const copyButton = screen.getByRole("button", {
      name: "clusters.fields.gpuNumber 1 clusters.actions.copyUuid",
    });
    fireEvent.pointerDown(copyButton);
    fireEvent.click(copyButton);
    expect(copyMock).toHaveBeenCalledWith("GPU-t4-01", expect.any(Object));
    expect(screen.queryByRole("dialog")).toBeNull();

    const replicaButton = screen.getAllByRole("button", {
      name: /observations\.replicaLabel/,
    })[0];
    fireEvent.pointerDown(replicaButton);
    fireEvent.click(replicaButton);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens once from the card pointer action, not from a synthetic click", () => {
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(makeReplica())}
      />,
    );

    const card = screen.getByTestId("runtime-gpu-card");
    fireEvent.click(card);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.pointerDown(card, { button: 0 });
    expect(screen.getByRole("dialog").textContent).toContain("GPU-t4-01");
  });

  it("keeps the card details action available from the keyboard", () => {
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(makeReplica())}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "observations.detailsForGpu:1",
      }),
    );
    expect(screen.getByRole("dialog").textContent).toContain("GPU-t4-01");
  });

  it("closes the details sheet from X without its portal event reopening the card", () => {
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(makeReplica())}
      />,
    );

    fireEvent.pointerDown(screen.getByTestId("runtime-gpu-card"), {
      button: 0,
    });
    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getAllByRole("button")[0];

    fireEvent.pointerDown(close, { button: 0 });
    fireEvent.click(close);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("adds multi-replica composition to the hovered bar and tooltip", async () => {
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(
          makeReplica(),
          makeReplica({
            replica_id: "endpoint-abc-1",
            devices: [makeDevice()],
          }),
        )}
        samples={[
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            6 * 1024 ** 3,
            endpointLabels("gpu-node-01", "GPU-t4-01"),
          ),
        ]}
      />,
    );

    const replica = screen.getAllByRole("button", {
      name: /observations\.replicaLabel/,
    })[0];
    fireEvent.focus(replica);
    const tooltip = await screen.findByRole("tooltip");
    within(tooltip).getByText("observations.modelWeights");
    within(tooltip).getByText("observations.l0KvCacheCapacity");
    within(tooltip).getByText("observations.otherReservation");
  });

  it("shows the composition directly when one replica owns the GPU", () => {
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(
          makeReplica({
            model_weights_mib: 1024,
            kv_cache_capacity_mib: 2048,
          }),
        )}
        samples={[
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            6 * 1024 ** 3,
            {
              ...deviceLabels("gpu-node-01", "GPU-t4-01"),
              endpoint: "endpoint-abc",
              replica: "endpoint-abc-0",
              instance_id: "endpoint-abc",
            },
          ),
        ]}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /observations\.replicaLabel/ }),
    ).toBeNull();

    const legend = screen.getByTestId("single-allocation-legend");
    within(legend).getByText("observations.modelWeights");
    within(legend).getByText("1.0 GiB");
    within(legend).getByText("observations.l0KvCacheCapacity");
    within(legend).getByText("2.0 GiB");
    within(legend).getByText("observations.otherReservation");
    within(legend).getByText("5.0 GiB");
    within(legend).getByText("observations.actualVramUsage");
    within(legend).getByText("6.0 GiB");
    expect(screen.queryByText(/observations\.requestedCapacity/)).toBeNull();
  });

  it("shows usage details without inventing composition when weights are absent", () => {
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(
          makeReplica({
            model_weights_mib: null,
            kv_cache_capacity_mib: null,
          }),
        )}
        samples={[
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            6 * 1024 ** 3,
            endpointLabels("gpu-node-01", "GPU-t4-01"),
          ),
        ]}
      />,
    );

    within(screen.getByTestId("single-allocation-legend")).getByText(
      "observations.actualVramUsage",
    );
    within(screen.getByTestId("single-allocation-legend")).getByText(
      "observations.allocatedUnused",
    );
    expect(screen.queryByText("observations.modelWeights")).toBeNull();
    expect(screen.queryByText("observations.l0KvCacheCapacity")).toBeNull();
    screen.getByText(/observations\.reservedOfPhysical:8\.0,80\.0/);
  });

  it("keeps known composition when Actual usage is unavailable", () => {
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(makeReplica())}
      />,
    );

    const legend = screen.getByTestId("single-allocation-legend");
    within(legend).getByText("observations.modelWeights");
    within(legend).getByText("observations.l0KvCacheCapacity");
    within(legend).getByText("observations.otherReservation");
    expect(
      within(legend).queryByText("observations.actualVramUsage"),
    ).toBeNull();
  });

  it("shows the overage when Actual usage exceeds reservation", () => {
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(makeReplica())}
        samples={[
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            9 * 1024 ** 3,
            endpointLabels("gpu-node-01", "GPU-t4-01"),
          ),
        ]}
      />,
    );

    const legend = screen.getByTestId("single-allocation-legend");
    within(legend).getByText("observations.actualVramUsage");
    within(legend).getByText("9.0 GiB");
    within(legend).getByText("observations.exceedsReservedBy:1.0 GiB");
  });

  it("does not add a tooltip trigger when each GPU has one replica", () => {
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(
          makeReplica(),
          makeReplica({
            replica_id: "endpoint-abc-1",
            devices: [makeDevice({ uuid: "GPU-t4-02", order: 2 })],
          }),
        )}
      />,
    );

    expect(screen.getAllByTestId("single-allocation-legend")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: /observations\.replicaLabel/ }),
    ).toBeNull();
  });

  it("uses Endpoint readings instead of physical device totals", () => {
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(makeReplica())}
        samples={[
          sample(
            "neutree_accelerator_memory_used_bytes",
            27 * 1024 ** 3,
            deviceLabels("gpu-node-01", "GPU-t4-01"),
          ),
          sample(
            "neutree_accelerator_utilization_ratio",
            0.9,
            deviceLabels("gpu-node-01", "GPU-t4-01"),
          ),
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            6 * 1024 ** 3,
            endpointLabels("gpu-node-01", "GPU-t4-01"),
          ),
          sample(
            "neutree_endpoint_replica_accelerator_utilization_ratio",
            0.45,
            endpointLabels("gpu-node-01", "GPU-t4-01"),
          ),
        ]}
      />,
    );

    const card = screen.getByTestId("runtime-gpu-card");
    expect(card.textContent).toContain("6.0");
    expect(card.textContent).toContain(
      "observations.reservedOfPhysical:8.0,80.0",
    );
    within(card).getByText("observations.computeAllocation");
    within(card).getByText("observations.coreAllocation:35");
    expect(card.textContent).toContain("45%");
    expect(card.textContent).not.toContain("27.0");
    expect(card.textContent).not.toContain("90%");
  });

  it("shows current Endpoint composition when it has one replica on a shared GPU", async () => {
    const currentDevice = makeDevice({
      memory_mib: 56 * 1024,
      allocatable: { memory_mib: 80 * 1024, core_units: 100 },
    });
    const sharedAllocation = (endpoint: string, memoryMiB: number) => ({
      endpoint,
      workspace: "design-lab",
      model: `${endpoint}-model`,
      node: "gpu-node-01",
      uuid: "GPU-t4-01",
      replica: "R0",
      instance: `${endpoint}-0`,
      memoryMiB,
    });
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        workspace="design-lab"
        gpuAllocations={[
          sharedAllocation("endpoint-abc", 56 * 1024),
          sharedAllocation("endpoint-beta", 10 * 1024),
        ]}
        resources={withReplicas(makeReplica({ devices: [currentDevice] }))}
        samples={[
          sample(
            "neutree_accelerator_memory_used_bytes",
            66 * 1024 ** 3,
            deviceLabels("gpu-node-01", "GPU-t4-01"),
          ),
          sample(
            "neutree_accelerator_utilization_ratio",
            0.53,
            deviceLabels("gpu-node-01", "GPU-t4-01"),
          ),
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            47 * 1024 ** 3,
            endpointLabels("gpu-node-01", "GPU-t4-01"),
          ),
          sample(
            "neutree_endpoint_replica_accelerator_utilization_ratio",
            0.41,
            endpointLabels("gpu-node-01", "GPU-t4-01"),
          ),
        ]}
      />,
    );

    const card = screen.getByTestId("runtime-gpu-card");
    expect(card.textContent).toContain(
      "observations.reservedOfPhysical:56.0,80.0",
    );
    expect(card.textContent).toContain("41%");
    expect(card.textContent).not.toContain("66.0");
    expect(card.textContent).not.toContain("53%");
    within(card).getByRole("img", {
      name: /observations\.otherEndpoints, 10\.0 GiB observations\.reservedLower/,
    });
    within(screen.getByTestId("allocation-ownership-legend")).getByText(
      "observations.thisEndpoint",
    );
    within(screen.getByTestId("allocation-ownership-legend")).getByText(
      "observations.unallocated",
    );
    within(card).getByTestId("single-allocation-legend");
    within(card).getByText("observations.modelWeights");
    within(card).getByText("observations.l0KvCacheCapacity");
    within(card).getByText("observations.otherReservation");
    expect(within(card).queryByText("R0")).toBeNull();

    const replica = screen.getByRole("button", {
      name: /observations\.replicaLabel R0/,
    });
    fireEvent.focus(replica);
    const tooltip = await screen.findByRole("tooltip");
    within(tooltip).getByText("observations.modelWeights");
    within(tooltip).getByText("observations.l0KvCacheCapacity");
    within(tooltip).getByText("observations.otherReservation");
    within(tooltip).getByText("observations.actualVramUsage");
  });

  it("labels replica segments and summarizes additional current replicas", async () => {
    const replicas = Array.from({ length: 9 }, (_, index) =>
      makeReplica({
        instance_id: `endpoint-${index}`,
        replica_id: `endpoint-${index}`,
        devices: [makeDevice({ order: index + 1 })],
      }),
    );
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(...replicas)}
      />,
    );

    const bar = screen.getByRole("group", {
      name: "observations.vramAllocation",
    });
    within(bar).getByText("R0");
    within(bar).getByText("R7");
    within(bar).getByText("+1");
    expect(within(bar).queryByText("observations.modelWeights")).toBeNull();
    expect(within(bar).queryByText("observations.otherReservation")).toBeNull();

    const more = screen.getByRole("button", {
      name: /observations\.moreReplicasLabel/,
    });
    fireEvent.focus(more);
    const tooltip = await screen.findByRole("tooltip");
    within(tooltip).getByText("observations.moreReplicas");
    within(tooltip).getByText(/observations\.moreReplicasLabel/);
  });

  it("ignores inconsistent device totals on a shared GPU", async () => {
    const currentDevice = makeDevice({
      memory_mib: 64 * 1024,
      allocatable: { memory_mib: 80 * 1024, core_units: 100 },
    });
    const sharedAllocation = (endpoint: string, memoryMiB: number) => ({
      endpoint,
      workspace: "design-lab",
      model: `${endpoint}-model`,
      node: "gpu-node-01",
      uuid: "GPU-t4-01",
      replica: "R0",
      instance: `${endpoint}-0`,
      memoryMiB,
    });
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        workspace="design-lab"
        gpuAllocations={[
          sharedAllocation("endpoint-abc", 64 * 1024),
          sharedAllocation("endpoint-beta", 16 * 1024),
        ]}
        resources={withReplicas(makeReplica({ devices: [currentDevice] }))}
        samples={[
          sample(
            "neutree_accelerator_memory_used_bytes",
            2 * 1024 ** 3,
            deviceLabels("gpu-node-01", "GPU-t4-01"),
          ),
          sample(
            "neutree_accelerator_utilization_ratio",
            0.03,
            deviceLabels("gpu-node-01", "GPU-t4-01"),
          ),
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            58 * 1024 ** 3,
            endpointLabels("gpu-node-01", "GPU-t4-01"),
          ),
          sample(
            "neutree_endpoint_replica_accelerator_utilization_ratio",
            0.8,
            endpointLabels("gpu-node-01", "GPU-t4-01"),
          ),
        ]}
      />,
    );

    const card = screen.getByTestId("runtime-gpu-card");
    expect(card.textContent).toContain(
      "observations.reservedOfPhysical:64.0,80.0",
    );
    expect(card.textContent).toContain("observations.utilization");
    expect(card.textContent).toContain("80%");
    expect(card.textContent).not.toContain("2.0 / 80.0");
    expect(card.textContent).not.toContain("3%");
    within(card).getByRole("img", {
      name: /observations\.otherEndpoints, 16\.0 GiB observations\.reservedLower/,
    });
    fireEvent.focus(
      screen.getByRole("button", {
        name: /observations\.replicaLabel R0/,
      }),
    );
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain("58.0 GiB");
  });

  it("shows a shared core allocation when the Endpoint has no limit", () => {
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(
          makeReplica({
            devices: [makeDevice({ core_units: 0 })],
          }),
        )}
      />,
    );

    within(screen.getByTestId("runtime-gpu-card")).getByText(
      "observations.sharedNoLimit",
    );
  });

  it("summarizes Endpoint VRAM and utilization for multiple GPUs", () => {
    const devices = [0, 1].map((index) =>
      makeDevice({
        uuid: `GPU-${index}`,
        order: index,
        memory_mib: 16 * 1024,
      }),
    );
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(makeReplica({ devices }))}
        samples={devices.flatMap((device, index) => [
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            10 * 1024 ** 3,
            endpointLabels(device.node_id ?? "", device.uuid),
          ),
          sample(
            "neutree_endpoint_replica_accelerator_utilization_ratio",
            index === 0 ? 0.5 : 0.75,
            endpointLabels(device.node_id ?? "", device.uuid),
          ),
        ])}
      />,
    );

    const summary = screen.getByTestId("runtime-summary");
    within(summary).getByText("32.0 GiB");
    within(summary).getByText("20.0 GiB");
    within(summary).getByText("63% · 75% peak");
  });

  it("sums Endpoint Replica readings when multiple replicas share one GPU", () => {
    render(
      <EndpointRuntimeResourcesCard
        endpointName="endpoint-abc"
        resources={withReplicas(
          makeReplica(),
          makeReplica({
            replica_id: "endpoint-abc-1",
          }),
        )}
        samples={[
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            6 * 1024 ** 3,
            {
              ...deviceLabels("gpu-node-01", "GPU-t4-01"),
              endpoint: "endpoint-abc",
              replica: "endpoint-abc-0",
              instance_id: "endpoint-abc",
            },
          ),
          sample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            6 * 1024 ** 3,
            {
              ...deviceLabels("gpu-node-01", "GPU-t4-01"),
              endpoint: "endpoint-abc",
              replica: "endpoint-abc-1",
              instance_id: "endpoint-abc",
            },
          ),
          sample(
            "neutree_endpoint_replica_accelerator_utilization_ratio",
            0.5,
            {
              ...deviceLabels("gpu-node-01", "GPU-t4-01"),
              endpoint: "endpoint-abc",
              replica: "endpoint-abc-0",
              instance_id: "endpoint-abc",
            },
          ),
          sample(
            "neutree_endpoint_replica_accelerator_utilization_ratio",
            0.75,
            {
              ...deviceLabels("gpu-node-01", "GPU-t4-01"),
              endpoint: "endpoint-abc",
              replica: "endpoint-abc-1",
              instance_id: "endpoint-abc",
            },
          ),
        ]}
      />,
    );

    const gpuCard = screen.getByTestId("runtime-gpu-card");
    expect(gpuCard.textContent).toContain(
      "observations.reservedOfPhysical:16.0,80.0",
    );
    expect(gpuCard.textContent).not.toContain("12.0");
    expect(gpuCard.textContent).toContain("75%");

    fireEvent.click(
      screen.getByRole("button", {
        name: "observations.detailsForGpu:1",
      }),
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("12.0");
    expect(dialog.textContent).toContain("observations.usedShare:75");
    expect(dialog.textContent).not.toContain("observations.status.no_data");
  });

  it("renders replica and allocated card counts outside the surface", () => {
    render(
      <EndpointRuntimeResourcesSummary
        resources={withReplicas(
          makeReplica(),
          makeReplica({
            replica_id: "endpoint-abc-1",
            devices: [makeDevice({ uuid: "GPU-t4-02", order: 2 })],
          }),
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
