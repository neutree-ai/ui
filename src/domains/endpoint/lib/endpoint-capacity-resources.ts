import type {
  EndpointResourceStatus,
  NodeResourceStatus,
} from "@/foundation/types/resource-types";

type ProductUsage = Record<string, { memory_mib: number; core_units: number }>;

type RestoreEndpointResourceOptions = {
  cpuPerReplica?: number | null;
  memoryPerReplica?: number | null;
};

const addCappedResource = (
  available: number | null | undefined,
  allocated: number | null | undefined,
  allocatable: number | null | undefined,
) => {
  const next = Number(available || 0) + Number(allocated || 0);
  return Number.isFinite(allocatable)
    ? Math.min(next, Number(allocatable))
    : next;
};

export const hasEndpointDeviceAllocations = (
  resourceStatus: EndpointResourceStatus | null | undefined,
) =>
  Boolean(resourceStatus?.replicas?.some((replica) => replica.devices?.length));

const addProductUsage = (
  productUsage: ProductUsage,
  product: string,
  memoryMiB: number | null | undefined,
  coreUnits: number | null | undefined,
) => {
  const current = productUsage[product] ?? { memory_mib: 0, core_units: 0 };
  productUsage[product] = {
    memory_mib: current.memory_mib + Number(memoryMiB || 0),
    core_units: current.core_units + Number(coreUnits || 0),
  };
};

export const restoreEndpointDeviceResourcesToNodeResources = (
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  resourceStatus: EndpointResourceStatus | null | undefined,
  options: RestoreEndpointResourceOptions = {},
) => {
  const productUsage: ProductUsage = {};

  for (const replica of resourceStatus?.replicas ?? []) {
    for (const allocation of replica.devices ?? []) {
      addProductUsage(
        productUsage,
        allocation.product,
        allocation.memory_mib,
        allocation.core_units,
      );
    }
  }

  if (!nodeResources || !resourceStatus?.replicas?.length) {
    return {
      nodeResources,
      productUsage,
      restoredDeviceAllocationCount: 0,
      restoredNodeResourceAllocationCount: 0,
    };
  }

  let nextNodeResources: Record<string, NodeResourceStatus> | null = null;
  let restoredDeviceAllocationCount = 0;
  let restoredNodeResourceAllocationCount = 0;

  const getCurrentNodeResources = () => nextNodeResources ?? nodeResources;

  const restoreReplicaNodeResources = (nodeName: string | null | undefined) => {
    if (!nodeName) return false;

    const cpuPerReplica = Number(options.cpuPerReplica || 0);
    const memoryPerReplica = Number(options.memoryPerReplica || 0);
    if (cpuPerReplica <= 0 && memoryPerReplica <= 0) return false;

    const currentNodeResources = getCurrentNodeResources();
    const currentNode = currentNodeResources[nodeName];
    if (!currentNode) return false;
    const shouldRestoreCpu =
      cpuPerReplica > 0 && typeof currentNode.available?.cpu === "number";
    const shouldRestoreMemory =
      memoryPerReplica > 0 &&
      typeof currentNode.available?.memory === "number";
    if (!shouldRestoreCpu && !shouldRestoreMemory) return false;

    nextNodeResources = nextNodeResources ?? { ...currentNodeResources };
    const nodeToUpdate = nextNodeResources[nodeName];
    const currentAvailable = nodeToUpdate.available ?? {
      accelerator_groups: null,
      cpu: 0,
      memory: 0,
    };
    nextNodeResources[nodeName] = {
      ...nodeToUpdate,
      available: {
        ...currentAvailable,
        cpu: shouldRestoreCpu
          ? addCappedResource(
              currentAvailable.cpu,
              cpuPerReplica,
              nodeToUpdate.allocatable?.cpu,
            )
          : currentAvailable.cpu,
        memory: shouldRestoreMemory
          ? addCappedResource(
              currentAvailable.memory,
              memoryPerReplica,
              nodeToUpdate.allocatable?.memory,
            )
          : currentAvailable.memory,
      },
    };

    return true;
  };

  const findDeviceLocation = (
    preferredNodeName: string | null | undefined,
    uuid: string,
    product: string,
  ) => {
    const currentNodeResources = getCurrentNodeResources();
    const preferredNode = preferredNodeName
      ? currentNodeResources[preferredNodeName]
      : undefined;
    const preferredDeviceIndex = preferredNode?.devices?.findIndex(
      (device) => device.uuid === uuid && device.product === product,
    );
    if (
      preferredNodeName &&
      preferredNode &&
      preferredDeviceIndex !== undefined &&
      preferredDeviceIndex >= 0
    ) {
      return { nodeName: preferredNodeName, deviceIndex: preferredDeviceIndex };
    }

    for (const [nodeName, nodeStatus] of Object.entries(currentNodeResources)) {
      const deviceIndex = nodeStatus.devices?.findIndex(
        (device) => device.uuid === uuid && device.product === product,
      );
      if (deviceIndex !== undefined && deviceIndex >= 0) {
        return { nodeName, deviceIndex };
      }
    }

    return null;
  };

  for (const replica of resourceStatus.replicas) {
    if (restoreReplicaNodeResources(replica.node_id)) {
      restoredNodeResourceAllocationCount += 1;
    }

    for (const allocation of replica.devices ?? []) {
      const location = findDeviceLocation(
        allocation.node_id || replica.node_id,
        allocation.uuid,
        allocation.product,
      );
      if (!location) continue;

      nextNodeResources = nextNodeResources ?? { ...nodeResources };
      const currentNode = nextNodeResources[location.nodeName];
      const currentDevices = [...(currentNode.devices ?? [])];
      const currentDevice = currentDevices[location.deviceIndex];
      currentDevices[location.deviceIndex] = {
        ...currentDevice,
        available: {
          memory_mib: addCappedResource(
            currentDevice.available?.memory_mib,
            allocation.memory_mib,
            currentDevice.allocatable?.memory_mib,
          ),
          core_units: addCappedResource(
            currentDevice.available?.core_units,
            allocation.core_units,
            currentDevice.allocatable?.core_units,
          ),
        },
      };
      nextNodeResources[location.nodeName] = {
        ...currentNode,
        devices: currentDevices,
      };
      restoredDeviceAllocationCount += 1;
    }
  }

  return {
    nodeResources: nextNodeResources ?? nodeResources,
    productUsage,
    restoredDeviceAllocationCount,
    restoredNodeResourceAllocationCount,
  };
};

export const addEndpointDeviceResourcesToNodeResources = (
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  resourceStatus: EndpointResourceStatus | null | undefined,
) =>
  restoreEndpointDeviceResourcesToNodeResources(nodeResources, resourceStatus)
    .nodeResources;
