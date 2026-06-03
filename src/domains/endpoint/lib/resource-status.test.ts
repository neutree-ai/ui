import { describe, expect, it } from "vitest";
import type { EndpointResourceStatus } from "@/foundation/types/resource-types";
import {
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
        product: "Tesla-T4",
        memoryMiB: 15360,
        coreUnits: 100,
      },
      {
        instanceId: "endpoint-def",
        replicaId: "",
        nodeId: "node-2",
        uuid: "GPU-2",
        product: "Tesla-T4",
        memoryMiB: 7680,
        coreUnits: 50,
      },
    ]);
  });

  it("returns empty rows when endpoint resources are missing", () => {
    expect(getEndpointResourceSummaryRows(null)).toEqual([]);
    expect(getEndpointReplicaResourceRows(undefined)).toEqual([]);
  });
});
