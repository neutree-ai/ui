import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EndpointRuntimeResourcesCard, {
  EndpointRuntimeResourcesSummary,
} from "./EndpointRuntimeResourcesCard";

const copyMock = vi.fn();
const translations: Record<string, string> = {
  "clusters.actions.copyUuid": "Copy UUID",
  "clusters.acceleratorTypes.nvidia_gpu": "NVIDIA GPU",
  "clusters.fields.coreUsage": "Core",
  "clusters.fields.gpuNumber": "GPU",
  "clusters.fields.memoryUsage": "VRAM",
  "clusters.messages.copyUuidFailed": "Copy failed",
  "clusters.messages.copyUuidSuccess": "UUID copied",
  "common.fields.acceleratorProduct": "Accelerator Product",
  "common.fields.createdAt": "Created at",
  "common.fields.cpu": "CPU",
  "common.fields.memory": "Memory",
  "common.fields.replica": "Replica",
  "endpoints.fields.actualMemory": "Actual usage",
  "endpoints.fields.allocatedCard": "allocated card",
  "endpoints.fields.allocatedCards": "allocated cards",
  "endpoints.fields.card": "card",
  "endpoints.fields.cards": "cards",
  "endpoints.fields.crossNodes": "Across {{count}} nodes",
  "endpoints.fields.instance": "Instance",
  "endpoints.fields.physicalMemory": "Physical VRAM",
  "endpoints.fields.replicaUnit": "replica",
  "endpoints.fields.replicaUnits": "replicas",
  "endpoints.fields.requestedMemory": "Requested VRAM",
  "endpoints.fields.restartCount": "Restarts",
  "endpoints.fields.vgpuMemory": "VRAM",
  "endpoints.fields.vramExceedsRequested": "Usage exceeds requested VRAM",
  "endpoints.sections.gpuAllocation": "GPU Allocation & Usage",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const value = translations[key] ?? key;
      return options?.count != null
        ? value.replace("{{count}}", String(options.count))
        : value;
    },
  }),
}));

vi.mock("@/foundation/hooks/use-copy-to-clipboard", () => ({
  useCopyToClipboard: () => ({
    copy: copyMock,
    copied: false,
  }),
}));

const t4 = {
  uuid: "GPU-t4-01",
  order: 1,
  product: "Tesla-T4",
  memory_mib: 8192,
  core_units: 35,
  node_id: "gpu-node-01",
  allocatable: { memory_mib: 81920, core_units: 100 },
  available: { memory_mib: 76288, core_units: 65 },
};

describe("EndpointRuntimeResourcesCard", () => {
  beforeEach(() => {
    copyMock.mockClear();
  });

  it("renders multiple replicas with single-node and multi-node host topology", () => {
    render(
      <EndpointRuntimeResourcesCard
        requestedResources={{
          cpu: 12,
          memory: 48,
          gpu: 2,
          accelerator: { type: "nvidia_gpu", product: "Tesla-T4" },
        }}
        resources={{
          summary: null,
          replicas: [
            {
              instance_id: "endpoint-abc",
              replica_id: "endpoint-abc-single-node",
              node_id: "gpu-node-01",
              devices: [
                {
                  uuid: "GPU-t4-01",
                  order: 1,
                  product: "Tesla-T4",
                  memory_mib: 8192,
                  core_units: 35,
                  node_id: "gpu-node-01",
                  allocatable: { memory_mib: 81920, core_units: 100 },
                  available: { memory_mib: 76288, core_units: 65 },
                },
                {
                  uuid: "GPU-t4-02",
                  order: 2,
                  product: "Tesla-T4",
                  memory_mib: 8192,
                  core_units: 35,
                  node_id: "gpu-node-01",
                  allocatable: { memory_mib: 81920, core_units: 100 },
                  available: { memory_mib: 74240, core_units: 60 },
                },
              ],
            },
            {
              instance_id: "endpoint-abc",
              replica_id: "endpoint-abc-multi-node",
              node_id: "gpu-node-02",
              devices: [
                {
                  uuid: "GPU-t4-11",
                  order: 1,
                  product: "Tesla-T4",
                  memory_mib: 8192,
                  core_units: 35,
                  node_id: "gpu-node-02",
                  allocatable: { memory_mib: 81920, core_units: 100 },
                  available: { memory_mib: 76288, core_units: 65 },
                },
                {
                  uuid: "GPU-t4-12",
                  order: 2,
                  product: "Tesla-T4",
                  memory_mib: 8192,
                  core_units: 35,
                  node_id: "gpu-node-02",
                  allocatable: { memory_mib: 81920, core_units: 100 },
                  available: { memory_mib: 74240, core_units: 60 },
                },
                {
                  uuid: "GPU-t4-13",
                  order: 3,
                  product: "Tesla-T4",
                  memory_mib: 8192,
                  core_units: 35,
                  node_id: "gpu-node-02",
                  allocatable: { memory_mib: 81920, core_units: 100 },
                  available: { memory_mib: 73216, core_units: 55 },
                },
                {
                  uuid: "GPU-t4-14",
                  order: 4,
                  product: "Tesla-T4",
                  memory_mib: 8192,
                  core_units: 35,
                  node_id: "gpu-node-02",
                  allocatable: { memory_mib: 81920, core_units: 100 },
                  available: { memory_mib: 72192, core_units: 50 },
                },
                {
                  uuid: "GPU-t4-21",
                  order: 1,
                  product: "Tesla-T4",
                  memory_mib: 8192,
                  core_units: 35,
                  node_id: "gpu-node-03",
                  allocatable: { memory_mib: 81920, core_units: 100 },
                  available: { memory_mib: 76288, core_units: 65 },
                },
                {
                  uuid: "GPU-t4-22",
                  order: 2,
                  product: "Tesla-T4",
                  memory_mib: 8192,
                  core_units: 35,
                  node_id: "gpu-node-03",
                  allocatable: { memory_mib: 81920, core_units: 100 },
                  available: { memory_mib: 74240, core_units: 60 },
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.queryByText("2 replicas / 8 allocated cards")).toBeNull();
    expect(screen.getAllByTestId("runtime-replica")).toHaveLength(2);
    expect(screen.getAllByTestId("runtime-host")).toHaveLength(3);
    expect(screen.getAllByTestId("runtime-gpu-cell")).toHaveLength(8);
    expect(screen.getByText("Replica 1")).toBeTruthy();
    expect(screen.getByText("Replica 2")).toBeTruthy();
    expect(screen.getByText("endpoint-abc-single-node")).toBeTruthy();
    expect(screen.getByText("endpoint-abc-multi-node")).toBeTruthy();
    expect(screen.queryByText(/Instance endpoint-abc/)).toBeNull();
    expect(screen.getByText("Core 70")).toBeTruthy();
    expect(screen.getByText("Core 210")).toBeTruthy();
    expect(screen.getByText("2 cards")).toBeTruthy();
    expect(screen.getByText("16.0 GiB VRAM")).toBeTruthy();
    expect(screen.getByText("Across 2 nodes")).toBeTruthy();
    expect(screen.queryByText("Created at")).toBeNull();
    expect(screen.queryByText("Restarts")).toBeNull();
    expect(screen.getByText("gpu-node-01")).toBeTruthy();
    expect(screen.getByText("gpu-node-02")).toBeTruthy();
    expect(screen.getByText("gpu-node-03")).toBeTruthy();

    expect(
      screen
        .getAllByTestId("runtime-host")
        .filter((host) =>
          /CPU 12\.0 · Memory 48\.0 GiB/.test(host.textContent ?? ""),
        ),
    ).toHaveLength(3);
    expect(screen.getAllByText("NVIDIA GPU · Tesla-T4")).toHaveLength(8);

    const gpuCells = screen.getAllByTestId("runtime-gpu-cell");
    const firstVram = within(gpuCells[0]).getByTestId("runtime-vram-values");
    expect(firstVram.textContent?.replace(/\s/g, "")).toBe("8/80GiB");
    const requestedFill = within(gpuCells[0]).getByTestId(
      "runtime-vram-requested-fill",
    );
    expect(requestedFill.style.width).toBe("10%");
    expect(requestedFill.className).toContain("--nt-fill-neutral-trans-7");
    expect(requestedFill.className).toContain(
      "dark:bg-[var(--nt-fill-neutral-trans-5)]",
    );
    expect(screen.queryByText("Actual usage")).toBeNull();
    expect(screen.getAllByText("Requested VRAM")).toHaveLength(2);
    expect(screen.getAllByText("Physical VRAM")).toHaveLength(2);
  });

  it("keeps the GPU row scrollable instead of clipping cards in a narrow container", () => {
    render(
      <EndpointRuntimeResourcesCard
        resources={{
          summary: null,
          replicas: [
            {
              instance_id: "endpoint-abc",
              replica_id: "endpoint-abc-single-node",
              node_id: "gpu-node-01",
              devices: [
                t4,
                { ...t4, uuid: "GPU-t4-02", order: 2 },
                { ...t4, uuid: "GPU-t4-03", order: 3 },
              ],
            },
          ],
        }}
      />,
    );

    // The rounded frame around the cells clips its own overflow, so the grid
    // has to claim the width its tracks demand. Without that the scroller
    // around it sees nothing to scroll and the last cards are simply cut off.
    const grid = screen.getAllByTestId("runtime-gpu-cell")[0]
      .parentElement as HTMLElement;
    expect(grid.style.minWidth).toBe("516px");
    expect(grid.parentElement?.className).toContain("overflow-x-auto");
  });

  it("falls back to a dash when physical VRAM is unavailable", () => {
    render(
      <EndpointRuntimeResourcesCard
        resources={{
          summary: null,
          replicas: [
            {
              instance_id: "endpoint-vgpu",
              replica_id: "endpoint-vgpu-0",
              node_id: "gpu-node-01",
              devices: [
                {
                  uuid: "GPU-vgpu-01",
                  product: "Tesla-T4",
                  memory_mib: 8192,
                  core_units: 0,
                  node_id: "gpu-node-01",
                },
              ],
            },
          ],
        }}
      />,
    );

    const gpuCell = screen.getByTestId("runtime-gpu-cell");
    const vram = within(gpuCell).getByTestId("runtime-vram-values");
    expect(vram.textContent?.replace(/\s/g, "")).toBe("8/—GiB");
    expect(
      within(screen.getByTestId("runtime-host")).getByText(/CPU —/),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId("runtime-host")).getByText(/Memory —/),
    ).toBeTruthy();
    expect(screen.getAllByText("Core -")).toHaveLength(2);
  });

  it("does not render legacy instance metadata", () => {
    render(
      <EndpointRuntimeResourcesCard
        resources={{
          summary: null,
          replicas: [
            {
              instance_id: "deepseek-r1-multinode-0",
              replica_id: "deepseek-r1-multinode-0",
              node_id: "gpu-node-01",
              devices: [t4],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("deepseek-r1-multinode-0")).toBeTruthy();
    expect(screen.queryByText(/Instance deepseek-r1-multinode-0/)).toBeNull();
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
        resources={{
          summary: null,
          replicas: [
            {
              instance_id: "qwen-coder-canary-0",
              replica_id: "qwen-coder-canary-0",
              node_id: "gpu-node-b",
              devices: [
                {
                  uuid: "GPU-L40S-B0",
                  product: "NVIDIA-L40S",
                  memory_mib: 24576,
                  core_units: 0,
                  node_id: "gpu-node-b",
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Core 50")).toBeTruthy();
  });

  it("does not expose actual VRAM usage when runtime status includes it", () => {
    render(
      <EndpointRuntimeResourcesCard
        resources={{
          summary: null,
          replicas: [
            {
              instance_id: "endpoint-over-request",
              replica_id: "endpoint-over-request-0",
              node_id: "gpu-node-01",
              devices: [
                {
                  uuid: "GPU-over-request-01",
                  order: 1,
                  product: "Tesla-T4",
                  memory_mib: 8192,
                  core_units: 35,
                  node_id: "gpu-node-01",
                  allocatable: { memory_mib: 81920, core_units: 100 },
                  available: { memory_mib: 69120, core_units: 65 },
                },
              ],
            },
          ],
        }}
      />,
    );

    const gpuCell = screen.getByTestId("runtime-gpu-cell");
    expect(
      within(gpuCell).queryByTestId("runtime-vram-over-requested"),
    ).toBeNull();
    expect(
      within(gpuCell).getByTestId("runtime-vram-bar").className,
    ).not.toContain("stroke-serious-light");
    const vram = within(gpuCell).getByTestId("runtime-vram-values");
    expect(vram.textContent?.replace(/\s/g, "")).toBe("8/80GiB");
    expect(gpuCell.textContent).not.toContain("12.5");
  });

  it("keeps long replica names on one line and exposes them via title", () => {
    const longName =
      "endpoint-with-a-very-long-replica-name-that-should-truncate";
    render(
      <EndpointRuntimeResourcesCard
        resources={{
          summary: null,
          replicas: [
            {
              instance_id: "endpoint-abc",
              replica_id: longName,
              node_id: "gpu-node-01",
              devices: [
                {
                  uuid: "GPU-long-name-01",
                  product: "Tesla-T4",
                  memory_mib: 8192,
                  core_units: 0,
                  node_id: "gpu-node-01",
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByTitle(longName)).toBeTruthy();
    expect(screen.getByTitle(longName).className).toContain("truncate");
  });

  it("copies a GPU UUID from the GPU cell", () => {
    render(
      <EndpointRuntimeResourcesCard
        resources={{
          summary: null,
          replicas: [
            {
              instance_id: "endpoint-abc",
              replica_id: "endpoint-abc-0",
              node_id: "gpu-node-01",
              devices: [t4],
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "GPU 1 Copy UUID" }));
    expect(copyMock).toHaveBeenCalledWith("GPU-t4-01", expect.any(Object));
  });

  it("renders the replica and allocated card summary outside the card", () => {
    render(
      <EndpointRuntimeResourcesSummary
        resources={{
          summary: null,
          replicas: [
            {
              instance_id: "endpoint-abc",
              replica_id: "endpoint-abc-0",
              node_id: "gpu-node-01",
              devices: [t4],
            },
            {
              instance_id: "endpoint-abc",
              replica_id: "endpoint-abc-1",
              node_id: "gpu-node-01",
              devices: [t4],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("2 replicas / 2 allocated cards")).toBeTruthy();
  });

  it("hides the runtime allocation summary when no GPU is allocated", () => {
    const { container } = render(
      <EndpointRuntimeResourcesSummary
        resources={{ summary: null, replicas: [] }}
      />,
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
            products: {
              "Tesla-T4": { memory_mib: 30720, core_units: 0 },
            },
          },
          replicas: [],
        }}
      />,
    );

    const summary = screen.getByTestId("runtime-resource-summary");
    expect(within(summary).getByText("Tesla-T4")).toBeTruthy();
    expect(within(summary).getByText("30.0 GiB")).toBeTruthy();
  });
});
