import { describe, expect, it } from "vitest";
import type { EndpointResourceStatus } from "@/foundation/types/resource-types";
import {
  getEndpointReplicaResourceGroups,
  getEndpointReplicaResourceRows,
  getEndpointResourceSummaryRows,
} from "./resource-status";

describe("endpoint resource status helpers", () => {
  it("builds product summary rows from endpoint resource status", () => {
    const resourceStatus: EndpointResourceStatus = {
      summary: {
        products: {
          "Tesla-T4": {
            memory_mib: 23040,
            core_units: 150,
          },
          "Tesla-A10": {
            memory_mib: 15360,
            core_units: 100,
          },
        },
      },
      replicas: [],
    };

    expect(getEndpointResourceSummaryRows(resourceStatus)).toEqual([
      {
        product: "Tesla-A10",
        memoryMiB: 15360,
        coreUnits: 100,
      },
      {
        product: "Tesla-T4",
        memoryMiB: 23040,
        coreUnits: 150,
      },
    ]);
  });

  it("builds replica device rows from endpoint resource status", () => {
    const resourceStatus: EndpointResourceStatus = {
      summary: null,
      replicas: [
        {
          instance_id: "endpoint-abc",
          replica_id: "uid-1",
          node_id: "node-1",
          devices: [
            {
              uuid: "GPU-1",
              product: "Tesla-T4",
              memory_mib: 15360,
              core_units: 100,
              node_id: "node-1",
            },
          ],
        },
        {
          instance_id: "endpoint-def",
          node_id: "node-2",
          devices: [
            {
              uuid: "GPU-2",
              product: "Tesla-T4",
              memory_mib: 7680,
              core_units: 50,
              node_id: "node-2",
            },
          ],
        },
      ],
    };

    expect(getEndpointReplicaResourceRows(resourceStatus)).toEqual([
      {
        instanceId: "endpoint-abc",
        replicaId: "uid-1",
        nodeId: "node-1",
        uuid: "GPU-1",
        order: null,
        product: "Tesla-T4",
        memoryMiB: 15360,
        coreUnits: 100,
      },
      {
        instanceId: "endpoint-def",
        replicaId: "",
        nodeId: "node-2",
        uuid: "GPU-2",
        order: null,
        product: "Tesla-T4",
        memoryMiB: 7680,
        coreUnits: 50,
      },
    ]);
  });

  it("groups replica device rows for multi-card replicas", () => {
    const resourceStatus: EndpointResourceStatus = {
      summary: null,
      replicas: [
        {
          instance_id: "endpoint-abc",
          replica_id: "endpoint-abc-xgpwv",
          node_id: "node-1",
          devices: [
            {
              uuid: "GPU-1",
              product: "Tesla-T4",
              memory_mib: 8192,
              core_units: 0,
              node_id: "node-1",
            },
            {
              uuid: "GPU-2",
              product: "Tesla-T4",
              memory_mib: 8192,
              core_units: 0,
              node_id: "node-1",
            },
          ],
        },
        {
          instance_id: "endpoint-abc",
          replica_id: "endpoint-abc-rq2nl",
          node_id: "node-2",
          devices: [
            {
              uuid: "GPU-3",
              product: "Tesla-T4",
              memory_mib: 8192,
              core_units: 0,
              node_id: "node-2",
            },
            {
              uuid: "GPU-4",
              product: "Tesla-T4",
              memory_mib: 8192,
              core_units: 0,
              node_id: "node-2",
            },
          ],
        },
      ],
    };

    expect(getEndpointReplicaResourceGroups(resourceStatus)).toEqual([
      {
        instanceId: "endpoint-abc",
        replicaId: "endpoint-abc-xgpwv",
        deviceCount: 2,
        memoryMiB: 16384,
        coreUnits: 0,
        devices: [
          {
            instanceId: "endpoint-abc",
            replicaId: "endpoint-abc-xgpwv",
            nodeId: "node-1",
            uuid: "GPU-1",
            order: null,
            product: "Tesla-T4",
            memoryMiB: 8192,
            coreUnits: 0,
          },
          {
            instanceId: "endpoint-abc",
            replicaId: "endpoint-abc-xgpwv",
            nodeId: "node-1",
            uuid: "GPU-2",
            order: null,
            product: "Tesla-T4",
            memoryMiB: 8192,
            coreUnits: 0,
          },
        ],
      },
      {
        instanceId: "endpoint-abc",
        replicaId: "endpoint-abc-rq2nl",
        deviceCount: 2,
        memoryMiB: 16384,
        coreUnits: 0,
        devices: [
          {
            instanceId: "endpoint-abc",
            replicaId: "endpoint-abc-rq2nl",
            nodeId: "node-2",
            uuid: "GPU-3",
            order: null,
            product: "Tesla-T4",
            memoryMiB: 8192,
            coreUnits: 0,
          },
          {
            instanceId: "endpoint-abc",
            replicaId: "endpoint-abc-rq2nl",
            nodeId: "node-2",
            uuid: "GPU-4",
            order: null,
            product: "Tesla-T4",
            memoryMiB: 8192,
            coreUnits: 0,
          },
        ],
      },
    ]);
  });

  it("orders replica devices by physical order with UUID fallback", () => {
    const resourceStatus: EndpointResourceStatus = {
      summary: null,
      replicas: [
        {
          instance_id: "endpoint-abc",
          replica_id: "endpoint-abc-xgpwv",
          node_id: "node-1",
          devices: [
            {
              uuid: "GPU-node-a-bbbbbbbb",
              order: 1,
              product: "Tesla-T4",
              memory_mib: 8192,
              core_units: 0,
              node_id: "node-1",
            },
            {
              uuid: "GPU-node-a-aaaaaaaa",
              order: 0,
              product: "Tesla-T4",
              memory_mib: 8192,
              core_units: 0,
              node_id: "node-1",
            },
            {
              uuid: "GPU-node-a-zzzzzzzz",
              product: "Tesla-T4",
              memory_mib: 8192,
              core_units: 0,
              node_id: "node-1",
            },
          ],
        },
      ],
    };

    expect(
      getEndpointReplicaResourceGroups(resourceStatus)[0].devices.map(
        (device) => ({
          order: device.order,
          uuid: device.uuid,
        }),
      ),
    ).toEqual([
      { order: 0, uuid: "GPU-node-a-aaaaaaaa" },
      { order: 1, uuid: "GPU-node-a-bbbbbbbb" },
      { order: null, uuid: "GPU-node-a-zzzzzzzz" },
    ]);
  });

  it("returns empty rows when endpoint resources are missing", () => {
    expect(getEndpointResourceSummaryRows(null)).toEqual([]);
    expect(getEndpointReplicaResourceRows(undefined)).toEqual([]);
    expect(getEndpointReplicaResourceGroups(undefined)).toEqual([]);
  });
});
