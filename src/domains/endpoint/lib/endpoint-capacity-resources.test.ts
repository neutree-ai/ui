import { describe, expect, it } from "vitest";
import {
  addEndpointDeviceResourcesToNodeResources,
  hasEndpointDeviceAllocations,
  restoreEndpointDeviceResourcesToNodeResources,
} from "@/domains/endpoint/lib/endpoint-capacity-resources";
import type {
  EndpointResourceStatus,
  NodeResourceStatus,
} from "@/foundation/types/resource-types";

describe("addEndpointDeviceResourcesToNodeResources", () => {
  it("adds endpoint device allocations back to matching node resources with allocatable caps", () => {
    const nodeResources: Record<string, NodeResourceStatus> = {
      "node-a": {
        allocatable: null,
        available: null,
        devices: [
          {
            uuid: "GPU-11111111-2222-3333-4444-555555555555",
            product: "Tesla-T4",
            health: true,
            allocatable: {
              memory_mib: 15360,
              core_units: 100,
            },
            available: {
              memory_mib: 7680,
              core_units: 50,
            },
          },
        ],
      },
    };
    const resourceStatus: EndpointResourceStatus = {
      replicas: [
        {
          instance_id: "endpoint-0",
          node_id: "node-a",
          devices: [
            {
              uuid: "GPU-11111111-2222-3333-4444-555555555555",
              product: "Tesla-T4",
              memory_mib: 8192,
              core_units: 50,
              node_id: "node-a",
            },
            {
              uuid: "GPU-11111111-2222-3333-4444-555555555555",
              product: "Tesla-T4",
              memory_mib: 8192,
              core_units: 50,
              node_id: "node-a",
            },
          ],
        },
      ],
    };

    const result = addEndpointDeviceResourcesToNodeResources(
      nodeResources,
      resourceStatus,
    );

    expect(result).not.toBe(nodeResources);
    expect(result?.["node-a"].devices).not.toBe(
      nodeResources["node-a"].devices,
    );
    expect(result?.["node-a"].devices?.[0].available).toEqual({
      memory_mib: 15360,
      core_units: 100,
    });
    expect(nodeResources["node-a"].devices?.[0].available).toEqual({
      memory_mib: 7680,
      core_units: 50,
    });
  });

  it("returns restore metadata and product usage from endpoint device allocations", () => {
    const nodeResources: Record<string, NodeResourceStatus> = {
      "node-a": {
        allocatable: null,
        available: null,
        devices: [
          {
            uuid: "GPU-11111111-2222-3333-4444-555555555555",
            product: "Tesla-T4",
            health: true,
            allocatable: {
              memory_mib: 15360,
              core_units: 100,
            },
            available: {
              memory_mib: 7680,
              core_units: 50,
            },
          },
        ],
      },
    };
    const resourceStatus: EndpointResourceStatus = {
      replicas: [
        {
          instance_id: "endpoint-0",
          node_id: "node-a",
          devices: [
            {
              uuid: "GPU-11111111-2222-3333-4444-555555555555",
              product: "Tesla-T4",
              memory_mib: 4096,
              core_units: 25,
              node_id: "node-a",
            },
            {
              uuid: "GPU-missing",
              product: "Tesla-T4",
              memory_mib: 2048,
              core_units: 10,
              node_id: "node-a",
            },
          ],
        },
      ],
    };

    expect(
      restoreEndpointDeviceResourcesToNodeResources(
        nodeResources,
        resourceStatus,
      ),
    ).toMatchObject({
      restoredDeviceAllocationCount: 1,
      productUsage: {
        "Tesla-T4": {
          memory_mib: 6144,
          core_units: 35,
        },
      },
    });
  });

  it("adds endpoint replica CPU and memory back to matching node resources with allocatable caps", () => {
    const nodeResources: Record<string, NodeResourceStatus> = {
      "node-a": {
        allocatable: {
          cpu: 16,
          memory: 64,
          accelerator_groups: null,
        },
        available: {
          cpu: 10,
          memory: 40,
          accelerator_groups: null,
        },
        devices: [],
      },
    };
    const resourceStatus: EndpointResourceStatus = {
      replicas: [
        {
          instance_id: "endpoint-0",
          node_id: "node-a",
          devices: [],
        },
        {
          instance_id: "endpoint-1",
          node_id: "node-a",
          devices: [],
        },
      ],
    };

    const result = restoreEndpointDeviceResourcesToNodeResources(
      nodeResources,
      resourceStatus,
      {
        cpuPerReplica: 4,
        memoryPerReplica: 16,
      },
    );

    expect(result.nodeResources).not.toBe(nodeResources);
    expect(result.nodeResources?.["node-a"].available).toMatchObject({
      cpu: 16,
      memory: 64,
    });
    expect(result.restoredNodeResourceAllocationCount).toBe(2);
    expect(nodeResources["node-a"].available).toMatchObject({
      cpu: 10,
      memory: 40,
    });
  });

  it("does not invent node CPU and memory availability when node resources lack those signals", () => {
    const nodeResources: Record<string, NodeResourceStatus> = {
      "node-a": {
        allocatable: null,
        available: null,
        devices: [],
      },
    };
    const resourceStatus: EndpointResourceStatus = {
      replicas: [
        {
          instance_id: "endpoint-0",
          node_id: "node-a",
          devices: [],
        },
      ],
    };

    const result = restoreEndpointDeviceResourcesToNodeResources(
      nodeResources,
      resourceStatus,
      {
        cpuPerReplica: 4,
        memoryPerReplica: 16,
      },
    );

    expect(result.nodeResources).toBe(nodeResources);
    expect(result.restoredNodeResourceAllocationCount).toBe(0);
  });

  it("keeps product usage when endpoint device allocations cannot be restored to node resources", () => {
    const nodeResources: Record<string, NodeResourceStatus> = {
      "node-a": {
        allocatable: null,
        available: null,
        devices: [
          {
            uuid: "GPU-present",
            product: "Tesla-T4",
            health: true,
            allocatable: {
              memory_mib: 15360,
              core_units: 100,
            },
            available: {
              memory_mib: 15360,
              core_units: 100,
            },
          },
        ],
      },
    };

    const result = restoreEndpointDeviceResourcesToNodeResources(
      nodeResources,
      {
        replicas: [
          {
            instance_id: "endpoint-0",
            node_id: "node-a",
            devices: [
              {
                uuid: "GPU-missing",
                product: "Tesla-T4",
                memory_mib: 8192,
                core_units: 50,
                node_id: "node-a",
              },
            ],
          },
        ],
      },
    );

    expect(result.nodeResources).toBe(nodeResources);
    expect(result.restoredDeviceAllocationCount).toBe(0);
    expect(result.productUsage).toEqual({
      "Tesla-T4": {
        memory_mib: 8192,
        core_units: 50,
      },
    });
  });

  it("keeps the original node resource reference when there are no endpoint allocations", () => {
    const nodeResources: Record<string, NodeResourceStatus> = {
      "node-a": {
        allocatable: null,
        available: null,
        devices: null,
      },
    };

    expect(addEndpointDeviceResourcesToNodeResources(nodeResources, null)).toBe(
      nodeResources,
    );
  });
});

describe("hasEndpointDeviceAllocations", () => {
  it("detects endpoint resource status with device allocations", () => {
    expect(
      hasEndpointDeviceAllocations({
        replicas: [
          {
            instance_id: "endpoint-0",
            devices: [
              {
                uuid: "GPU-11111111-2222-3333-4444-555555555555",
                product: "Tesla-T4",
                memory_mib: 8192,
                core_units: 50,
                node_id: "node-a",
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it("ignores missing device allocation details", () => {
    expect(
      hasEndpointDeviceAllocations({
        replicas: [
          {
            instance_id: "endpoint-0",
            devices: null,
          },
        ],
      }),
    ).toBe(false);
  });
});
