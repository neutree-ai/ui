import {
  compareDevicesByOrderThenUuid,
  getDeviceOrder,
} from "@/foundation/lib/device-resource-utils";
import type { EndpointResourceStatus } from "@/foundation/types/resource-types";

type EndpointResourceSummaryRow = {
  product: string;
  memoryMiB: number;
  coreUnits: number;
};

type EndpointReplicaResourceRow = {
  instanceId: string;
  replicaId: string;
  nodeId: string;
  uuid: string;
  order: number | null;
  product: string;
  memoryMiB: number;
  coreUnits: number;
};

type EndpointReplicaResourceGroup = {
  instanceId: string;
  replicaId: string;
  deviceCount: number;
  memoryMiB: number;
  coreUnits: number;
  devices: EndpointReplicaResourceRow[];
};

type ReplicaDeviceAllocation = NonNullable<
  NonNullable<EndpointResourceStatus["replicas"]>[number]["devices"]
>[number];

const toReplicaResourceRow = (
  replica: NonNullable<EndpointResourceStatus["replicas"]>[number],
  device: ReplicaDeviceAllocation,
): EndpointReplicaResourceRow => ({
  instanceId: replica.instance_id,
  replicaId: replica.replica_id ?? "",
  nodeId: device.node_id || replica.node_id || "",
  uuid: device.uuid,
  order: getDeviceOrder(device.order),
  product: device.product,
  memoryMiB: device.memory_mib,
  coreUnits: device.core_units,
});

export function getEndpointResourceSummaryRows(
  resourceStatus: EndpointResourceStatus | null | undefined,
): EndpointResourceSummaryRow[] {
  return Object.entries(resourceStatus?.summary?.products ?? {})
    .map(([product, usage]) => ({
      product,
      memoryMiB: usage.memory_mib,
      coreUnits: usage.core_units,
    }))
    .sort((a, b) => a.product.localeCompare(b.product));
}

export function getEndpointReplicaResourceRows(
  resourceStatus: EndpointResourceStatus | null | undefined,
): EndpointReplicaResourceRow[] {
  return (resourceStatus?.replicas ?? []).flatMap((replica) =>
    [...(replica.devices ?? [])]
      .sort(compareDevicesByOrderThenUuid)
      .map((device) => toReplicaResourceRow(replica, device)),
  );
}

export function getEndpointReplicaResourceGroups(
  resourceStatus: EndpointResourceStatus | null | undefined,
): EndpointReplicaResourceGroup[] {
  return (resourceStatus?.replicas ?? [])
    .map((replica) => {
      const devices = [...(replica.devices ?? [])]
        .sort(compareDevicesByOrderThenUuid)
        .map((device) => toReplicaResourceRow(replica, device));

      return {
        instanceId: replica.instance_id,
        replicaId: replica.replica_id ?? "",
        deviceCount: devices.length,
        memoryMiB: devices.reduce((sum, device) => sum + device.memoryMiB, 0),
        coreUnits: devices.reduce((sum, device) => sum + device.coreUnits, 0),
        devices,
      };
    })
    .filter((group) => group.deviceCount > 0);
}
