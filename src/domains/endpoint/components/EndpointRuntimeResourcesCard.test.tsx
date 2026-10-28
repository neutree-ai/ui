import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";
import EndpointRuntimeResourcesCard, {
  EndpointRuntimeResourcesSummary,
} from "./EndpointRuntimeResourcesCard";

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
  devices: [makeDevice()],
  ...overrides,
});

const withReplicas = (...replicas: Replica[]): RuntimeResources => ({
  summary: null,
  replicas,
});

/** A device whose runtime status reports no physical capacity. */
const bareDevice = (overrides: Partial<Device> = {}): Device => ({
  uuid: "GPU-vgpu-01",
  product: "Tesla-T4",
  memory_mib: 8192,
  core_units: 0,
  node_id: "gpu-node-01",
  ...overrides,
});

const vramValues = () =>
  within(screen.getByTestId("runtime-gpu-cell"))
    .getByTestId("runtime-vram-values")
    .textContent?.replace(/\s/g, "");

describe("EndpointRuntimeResourcesCard", () => {
  beforeEach(() => {
    copyMock.mockClear();
    vi.mocked(useIsTruncated).mockReturnValue(false);
  });

  it("renders multiple replicas with single-node and multi-node host topology", () => {
    const devicesOn = (node: string, uuids: string[]) =>
      uuids.map((uuid, index) =>
        makeDevice({ uuid, order: index + 1, node_id: node }),
      );

    render(
      <EndpointRuntimeResourcesCard
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
              ...devicesOn("gpu-node-02", ["GPU-t4-13", "GPU-t4-14"]),
              ...devicesOn("gpu-node-03", ["GPU-t4-21", "GPU-t4-22"]),
            ],
          }),
        )}
      />,
    );

    expect(screen.getAllByTestId("runtime-replica")).toHaveLength(2);
    expect(screen.getAllByTestId("runtime-host")).toHaveLength(3);
    expect(screen.getAllByTestId("runtime-gpu-cell")).toHaveLength(8);
    screen.getByText("common.fields.replica 0");
    screen.getByText("common.fields.replica 1");
    screen.getByText("endpoint-abc-single-node");
    screen.getByText("endpoint-abc-multi-node");
    screen.getByText("clusters.fields.coreUsage 70");
    screen.getByText("clusters.fields.coreUsage 210");
    screen.getByText("2 endpoints.fields.cards");
    screen.getByText("16.0 GiB endpoints.fields.vgpuMemory");
    screen.getByText("endpoints.fields.crossNodes:2");
    screen.getByText("gpu-node-01");
    screen.getByText("gpu-node-02");
    screen.getByText("gpu-node-03");
    expect(
      screen
        .getAllByTestId("runtime-host")
        .filter((host) =>
          /common\.fields\.cpu 12\.0 · common\.fields\.memory 48\.0 GiB/.test(
            host.textContent ?? "",
          ),
        ),
    ).toHaveLength(3);
    expect(
      screen.getAllByText("clusters.acceleratorTypes.nvidia_gpu · Tesla-T4"),
    ).toHaveLength(8);
    expect(screen.queryByText(/endpoints\.fields\.instance/)).toBeNull();

    const [firstCell] = screen.getAllByTestId("runtime-gpu-cell");
    expect(
      within(firstCell)
        .getByTestId("runtime-vram-values")
        .textContent?.replace(/\s/g, ""),
    ).toBe("8/80GiB");
    expect(
      within(firstCell)
        .getByTestId("runtime-vram-bar")
        .getAttribute("aria-valuenow"),
    ).toBe("10");
    // The summary line lives outside the card, and the card shows only the
    // requested VRAM, never the actual usage.
    expect(screen.queryByText(/endpoints\.fields\.allocatedCards/)).toBeNull();
    expect(screen.queryByText("endpoints.fields.actualMemory")).toBeNull();
  });

  it("uses the shared placeholder when a replica has no identifier", () => {
    render(
      <EndpointRuntimeResourcesCard
        requestedResources={{
          cpu: 1,
          memory: 1,
          gpu: 1,
          accelerator: { type: "nvidia_gpu", product: "Tesla-T4" },
        }}
        resources={withReplicas(
          makeReplica({ instance_id: "", replica_id: null }),
        )}
      />,
    );

    const replica = screen.getByTestId("runtime-replica");
    expect(within(replica).getByTestId("empty-value").textContent).toBe("-");
  });

  it("falls back to a dash when physical VRAM is unavailable", () => {
    render(
      <EndpointRuntimeResourcesCard
        resources={withReplicas(makeReplica({ devices: [bareDevice()] }))}
      />,
    );

    expect(vramValues()).toBe("8/-GiB");
    const bodyText = document.body.textContent ?? "";
    expect(bodyText).toContain("common.fields.cpu -");
    expect(bodyText).toContain("common.fields.memory -");
    expect(bodyText.match(/clusters\.fields\.coreUsage -/g) ?? []).toHaveLength(
      2,
    );
  });

  it("uses matching cluster metadata when device physical VRAM is unavailable", () => {
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
        requestedResources={{
          cpu: 4,
          memory: 8,
          gpu: 1,
          accelerator: { type: "nvidia_gpu", product: "Tesla-T4" },
        }}
        clusterResourceInfo={clusterResourceInfo}
        resources={withReplicas(makeReplica({ devices: [bareDevice()] }))}
      />,
    );

    expect(vramValues()).toBe("8/15GiB");
  });

  it("uses the requested vGPU core percentage when runtime core units are unavailable", () => {
    render(
      <EndpointRuntimeResourcesCard
        requestedResources={{
          cpu: 12,
          memory: 48,
          gpu: 1,
          accelerator: {
            type: "nvidia_gpu",
            product: "NVIDIA-L40S",
            virtualization: { memory_mib: 24576, core_percent: 50 },
          },
        }}
        resources={withReplicas(
          makeReplica({
            devices: [
              bareDevice({ product: "NVIDIA-L40S", memory_mib: 24576 }),
            ],
          }),
        )}
      />,
    );

    screen.getByText("clusters.fields.coreUsage 50");
  });

  it("does not expose actual VRAM usage when runtime status includes it", () => {
    render(
      <EndpointRuntimeResourcesCard
        resources={withReplicas(
          makeReplica({
            devices: [
              makeDevice({
                available: { memory_mib: 69120, core_units: 65 },
              }),
            ],
          }),
        )}
      />,
    );

    const gpuCell = screen.getByTestId("runtime-gpu-cell");
    expect(
      within(gpuCell).queryByTestId("runtime-vram-over-requested"),
    ).toBeNull();
    expect(vramValues()).toBe("8/80GiB");
    expect(gpuCell.textContent).not.toContain("12.5");
  });

  it("exposes a long replica name via title", () => {
    const longName =
      "endpoint-with-a-very-long-replica-name-that-should-truncate";
    render(
      <EndpointRuntimeResourcesCard
        resources={withReplicas(makeReplica({ replica_id: longName }))}
      />,
    );

    screen.getByTitle(longName);
  });

  it("copies a GPU UUID from the GPU cell", () => {
    render(
      <EndpointRuntimeResourcesCard resources={withReplicas(makeReplica())} />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "clusters.fields.gpuNumber 1 clusters.actions.copyUuid",
      }),
    );
    expect(copyMock).toHaveBeenCalledWith("GPU-t4-01", expect.any(Object));
  });

  it("keeps the truncated GPU product reachable from the keyboard", async () => {
    const longProduct = "NVIDIA_RTX_5000_Ada_Generation_Server_Edition";
    vi.mocked(useIsTruncated).mockReturnValue(true);

    render(
      <EndpointRuntimeResourcesCard
        resources={withReplicas(
          makeReplica({ devices: [makeDevice({ product: longProduct })] }),
        )}
      />,
    );

    const product = screen.getByTestId("runtime-gpu-product");
    expect(product.textContent).toBe(longProduct);
    // Truncated, so the tooltip is the only way to the whole name — which means
    // hover alone is not enough: the cell has to be a tab stop.
    expect(product.getAttribute("tabindex")).toBe("0");

    fireEvent.focus(product);

    expect((await screen.findByRole("tooltip")).textContent).toContain(
      longProduct,
    );
  });

  it("leaves a product name that fits alone", () => {
    render(
      <EndpointRuntimeResourcesCard resources={withReplicas(makeReplica())} />,
    );

    const product = screen.getByTestId("runtime-gpu-product");
    expect(product.getAttribute("tabindex")).toBeNull();

    fireEvent.mouseEnter(product);

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows a dash when the device reports no product name", async () => {
    vi.mocked(useIsTruncated).mockReturnValue(true);

    render(
      <EndpointRuntimeResourcesCard
        resources={withReplicas(
          makeReplica({ devices: [makeDevice({ product: "" })] }),
        )}
      />,
    );

    const product = screen.getByTestId("runtime-gpu-product");
    // Both the line and its tooltip fall back to the same dash rather than
    // printing an empty line, or an empty popup over one.
    expect(product.textContent).toBe("-");

    fireEvent.focus(product);

    expect((await screen.findByRole("tooltip")).textContent).toBe("-");
  });

  it("renders the replica and allocated card summary outside the card", () => {
    render(
      <EndpointRuntimeResourcesSummary
        resources={withReplicas(
          makeReplica(),
          makeReplica({ replica_id: "endpoint-abc-1" }),
        )}
      />,
    );

    screen.getByText(
      "2 endpoints.fields.replicaUnits / 2 endpoints.fields.allocatedCards",
    );
  });

  it("hides the runtime allocation summary when no GPU is allocated", () => {
    const { container } = render(
      <EndpointRuntimeResourcesSummary resources={withReplicas()} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when runtime resources are empty", () => {
    const { container } = render(
      <EndpointRuntimeResourcesCard resources={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders product summary fallback when no replicas are present", () => {
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
