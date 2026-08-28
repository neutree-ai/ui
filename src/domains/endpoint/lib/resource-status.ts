import {
  compareDevicesByOrderThenUuid,
  getDeviceOrder,
} from "@/foundation/lib/device-resource-utils";
import type {
  ClusterResourceInfo,
  DeviceAllocation,
  EndpointResourceStatus,
} from "@/foundation/types/resource-types";

type EndpointResourceSummaryRow = {
  product: string;
  memoryMiB: number;
  coreUnits: number;
};

export type EndpointReplicaResourceRow = {
  instanceId: string;
  replicaId: string;
  nodeId: string;
  uuid: string;
  order: number | null;
  product: string;
  memoryMiB: number;
  coreUnits: number;
  physicalMemoryMiB: number | null;
  actualMemoryMiB: number | null;
};

export type EndpointReplicaNodeResourceGroup = {
  nodeId: string;
  deviceCount: number;
  memoryMiB: number;
  coreUnits: number;
  devices: EndpointReplicaResourceRow[];
};

export type EndpointReplicaResourceGroup = {
  instanceId: string;
  replicaId: string;
  deviceCount: number;
  memoryMiB: number;
  coreUnits: number;
  nodeCount: number;
  maxNodeDeviceCount: number;
  nodes: EndpointReplicaNodeResourceGroup[];
};

type EndpointResourceResolutionOptions = {
  clusterResourceInfo?: ClusterResourceInfo | null;
  acceleratorType?: string | null;
};

const resolvePhysicalMemoryMiB = (
  device: DeviceAllocation,
  { clusterResourceInfo, acceleratorType }: EndpointResourceResolutionOptions,
) => {
  const products = acceleratorType
    ? clusterResourceInfo?.accelerator_metadata?.[acceleratorType]?.products
    : undefined;

  return (
    device.allocatable?.memory_mib ??
    products?.[device.product]?.memory_total_mib ??
    null
  );
};

const toReplicaResourceRow = (
  replica: NonNullable<EndpointResourceStatus["replicas"]>[number],
  device: DeviceAllocation,
  options: EndpointResourceResolutionOptions,
): EndpointReplicaResourceRow => {
  const physicalMemoryMiB = resolvePhysicalMemoryMiB(device, options);
  const availableMemoryMiB = device.available?.memory_mib ?? null;
  const actualMemoryMiB =
    physicalMemoryMiB != null && availableMemoryMiB != null
      ? Math.max(0, physicalMemoryMiB - availableMemoryMiB)
      : null;

  return {
    instanceId: replica.instance_id,
    replicaId: replica.replica_id ?? "",
    nodeId: device.node_id || replica.node_id || "",
    uuid: device.uuid,
    order: getDeviceOrder(device.order),
    product: device.product,
    memoryMiB: device.memory_mib,
    coreUnits: device.core_units,
    physicalMemoryMiB,
    actualMemoryMiB,
  };
};

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
  options: EndpointResourceResolutionOptions = {},
): EndpointReplicaResourceRow[] {
  return (resourceStatus?.replicas ?? []).flatMap((replica) =>
    [...(replica.devices ?? [])]
      .sort(compareDevicesByOrderThenUuid)
      .map((device) => toReplicaResourceRow(replica, device, options)),
  );
}

export function getEndpointReplicaResourceGroups(
  resourceStatus: EndpointResourceStatus | null | undefined,
  options: EndpointResourceResolutionOptions = {},
): EndpointReplicaResourceGroup[] {
  return (resourceStatus?.replicas ?? [])
    .map((replica) => {
      const devices = [...(replica.devices ?? [])]
        .sort(compareDevicesByOrderThenUuid)
        .map((device) => toReplicaResourceRow(replica, device, options));

      const nodes = groupDevicesByNode(devices);

      return {
        instanceId: replica.instance_id,
        replicaId: replica.replica_id ?? "",
        deviceCount: devices.length,
        memoryMiB: devices.reduce((sum, device) => sum + device.memoryMiB, 0),
        coreUnits: devices.reduce((sum, device) => sum + device.coreUnits, 0),
        nodeCount: nodes.length,
        maxNodeDeviceCount: nodes.reduce(
          (max, node) => Math.max(max, node.deviceCount),
          0,
        ),
        nodes,
      };
    })
    .filter((group) => group.deviceCount > 0);
}

function groupDevicesByNode(
  devices: EndpointReplicaResourceRow[],
): EndpointReplicaNodeResourceGroup[] {
  const groups = new Map<string, EndpointReplicaNodeResourceGroup>();

  for (const device of devices) {
    const nodeId = device.nodeId || "-";
    const existing = groups.get(nodeId);

    const group = existing ?? {
      nodeId,
      deviceCount: 0,
      memoryMiB: 0,
      coreUnits: 0,
      devices: [],
    };

    if (!existing) {
      groups.set(nodeId, group);
    }

    group.deviceCount += 1;
    group.memoryMiB += device.memoryMiB;
    group.coreUnits += device.coreUnits;
    group.devices.push(device);
  }

  return Array.from(groups.values());
}
