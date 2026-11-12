import { EMPTY_VALUE } from "@/foundation/components/EmptyValue";
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
  modelWeightsMiB: number | null;
  kvCacheCapacityMiB: number | null;
  vdeviceIndex?: string | null;
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
  modelWeightsMiB: number | null;
  kvCacheCapacityMiB: number | null;
  nodeCount: number;
  maxNodeDeviceCount: number;
  nodes: EndpointReplicaNodeResourceGroup[];
};

export type EndpointGpuResourceAllocation = EndpointReplicaResourceRow & {
  replicaIndex: number;
  replicaKey: string;
};

export type EndpointGpuResourceGroup = {
  key: string;
  nodeId: string;
  uuid: string;
  order: number | null;
  product: string;
  physicalMemoryMiB: number | null;
  allocations: EndpointGpuResourceAllocation[];
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
    ...(device.vdevice_index != null
      ? { vdeviceIndex: device.vdevice_index }
      : {}),
    order: getDeviceOrder(device.order),
    product: device.product,
    memoryMiB: device.memory_mib,
    coreUnits: device.core_units,
    physicalMemoryMiB,
    actualMemoryMiB,
    modelWeightsMiB: replica.model_weights_mib ?? null,
    kvCacheCapacityMiB: replica.kv_cache_capacity_mib ?? null,
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
  const grouped = new Map<
    string,
    NonNullable<EndpointResourceStatus["replicas"]>
  >();

  (resourceStatus?.replicas ?? []).forEach((replica, index) => {
    const key = `${replica.instance_id}\u0000${replica.replica_id ?? `row-${index}`}`;
    grouped.set(key, [...(grouped.get(key) ?? []), replica]);
  });

  return Array.from(grouped.values())
    .map((replicas) => {
      const devices = replicas
        .flatMap((replica) =>
          (replica.devices ?? []).map((device) =>
            toReplicaResourceRow(replica, device, options),
          ),
        )
        .sort(compareDevicesByOrderThenUuid);
      const nodes = groupDevicesByNode(devices);
      const first = replicas[0];

      return {
        instanceId: first.instance_id,
        replicaId: first.replica_id ?? "",
        deviceCount: devices.length,
        memoryMiB: devices.reduce((sum, device) => sum + device.memoryMiB, 0),
        coreUnits: devices.reduce((sum, device) => sum + device.coreUnits, 0),
        modelWeightsMiB:
          replicas.find((replica) => replica.model_weights_mib != null)
            ?.model_weights_mib ?? null,
        kvCacheCapacityMiB:
          replicas.find((replica) => replica.kv_cache_capacity_mib != null)
            ?.kv_cache_capacity_mib ?? null,
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

export function getEndpointGpuResourceGroups(
  resourceStatus: EndpointResourceStatus | null | undefined,
  options: EndpointResourceResolutionOptions = {},
): EndpointGpuResourceGroup[] {
  const groups = getEndpointReplicaResourceGroups(resourceStatus, options);
  const byDevice = new Map<string, EndpointGpuResourceGroup>();

  groups.forEach((replica, replicaIndex) => {
    for (const row of replica.nodes.flatMap((node) => node.devices)) {
      const key = `${row.nodeId}\u0000${row.uuid}`;
      const existing = byDevice.get(key);
      const allocation: EndpointGpuResourceAllocation = {
        ...row,
        replicaIndex,
        replicaKey: `${replica.instanceId}\u0000${replica.replicaId || replicaIndex}`,
      };

      if (existing) {
        existing.allocations.push(allocation);
        existing.physicalMemoryMiB ??= row.physicalMemoryMiB;
        continue;
      }

      byDevice.set(key, {
        key,
        nodeId: row.nodeId,
        uuid: row.uuid,
        order: row.order,
        product: row.product,
        physicalMemoryMiB: row.physicalMemoryMiB,
        allocations: [allocation],
      });
    }
  });

  return Array.from(byDevice.values())
    .map((device) => ({
      ...device,
      allocations: [...device.allocations].sort(
        (left, right) => left.replicaIndex - right.replicaIndex,
      ),
    }))
    .sort(
      (left, right) =>
        left.nodeId.localeCompare(right.nodeId) ||
        (left.order ?? Number.MAX_SAFE_INTEGER) -
          (right.order ?? Number.MAX_SAFE_INTEGER) ||
        left.uuid.localeCompare(right.uuid),
    );
}

function groupDevicesByNode(
  devices: EndpointReplicaResourceRow[],
): EndpointReplicaNodeResourceGroup[] {
  const groups = new Map<string, EndpointReplicaNodeResourceGroup>();

  for (const device of devices) {
    const nodeId = device.nodeId || EMPTY_VALUE;
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
