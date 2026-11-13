import {
  type GpuDeviceResourceRow,
  getFractionalGpuCoreRequirement,
  isDeviceAvailableForFullCardAllocation,
} from "@/foundation/lib/gpu-device-resources";
import type {
  DeviceResource,
  NodeResourceStatus,
} from "@/foundation/types/resource-types";

/** What one endpoint replica asks of the cluster, as the resources panel sees it. */
export type EndpointResourceRequestContext = {
  allocationMode: "full" | "fractional" | "vgpu";
  gpuPerReplica?: number | null;
  cpuPerReplica?: number | null;
  memoryPerReplica?: number | null;
  requestedFullGpuCards: number;
  fullGpuCardCapacity: number;
  fullGpuCapacityExceeded: boolean;
  requestedVirtualCards: number;
  totalVirtualCardCapacity: number;
  requestedVgpuMemoryMiB: number;
  availableVgpuMemoryMiB: number;
  requestedVgpuCoreUnits: number;
  availableVgpuCoreUnits: number;
  memoryMiBPerCard?: number | null;
  coreUnitsPerCard?: number | null;
  vgpuCapacityExceeded: boolean;
};

const getFiniteResourceValue = (
  value: number | null | undefined,
): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const getDeviceResourceValue = (
  device: DeviceResource | undefined,
  field: "memory_mib" | "core_units",
  fallback: number | null | undefined,
) =>
  getFiniteResourceValue(device?.available?.[field]) ??
  getFiniteResourceValue(fallback) ??
  0;

const getDeviceAllocatableResourceValue = (
  device: DeviceResource | undefined,
  field: "memory_mib" | "core_units",
  fallback: number | null | undefined,
) =>
  getFiniteResourceValue(device?.allocatable?.[field]) ??
  getFiniteResourceValue(fallback);

/**
 * Whether one replica of `request` could be placed on the device behind `row`.
 * The node's CPU and memory must fit too; `schedulingNodeStatus` is the node as
 * the scheduler sees it (an edit adds the endpoint's own allocations back), and
 * its device readings win over the row's. Without a request, a device is usable
 * when it is healthy, of the selected product and entirely free.
 */
export const isDeviceUsableForRequest = (
  row: GpuDeviceResourceRow,
  request: EndpointResourceRequestContext | undefined,
  schedulingNodeStatus?: NodeResourceStatus,
) => {
  if (!request) {
    return row.healthy && row.matchesSelectedAccelerator && row.fullFree;
  }

  if (!row.healthy || !row.matchesSelectedAccelerator) {
    return false;
  }

  const cpuPerReplica = Number(request.cpuPerReplica || 0);
  const memoryPerReplica = Number(request.memoryPerReplica || 0);
  const availableCpu = Number(schedulingNodeStatus?.available?.cpu);
  const nodeAvailableMemory = Number(schedulingNodeStatus?.available?.memory);
  if (
    cpuPerReplica > 0 &&
    Number.isFinite(availableCpu) &&
    availableCpu < cpuPerReplica
  ) {
    return false;
  }
  if (
    memoryPerReplica > 0 &&
    Number.isFinite(nodeAvailableMemory) &&
    nodeAvailableMemory < memoryPerReplica
  ) {
    return false;
  }

  const schedulingDevice = schedulingNodeStatus?.devices?.find(
    (device) => device.uuid === row.uuid && device.product === row.product,
  );
  const availableMemory = getDeviceResourceValue(
    schedulingDevice,
    "memory_mib",
    row.memory.available,
  );
  const availableCore = getDeviceResourceValue(
    schedulingDevice,
    "core_units",
    row.core.available,
  );

  if (request.allocationMode === "full") {
    return schedulingDevice
      ? isDeviceAvailableForFullCardAllocation(schedulingDevice)
      : row.fullFree;
  }

  if (request.allocationMode === "fractional") {
    const totalCore = getDeviceAllocatableResourceValue(
      schedulingDevice,
      "core_units",
      row.core.total,
    );
    const requiredCore = getFractionalGpuCoreRequirement(
      request.gpuPerReplica,
      totalCore,
    );

    return requiredCore != null && availableCore >= requiredCore;
  }

  const memoryMiBPerCard = Number(request.memoryMiBPerCard || 0);
  const coreUnitsPerCard = Number(request.coreUnitsPerCard || 0);

  if (memoryMiBPerCard > 0 && availableMemory < memoryMiBPerCard) {
    return false;
  }

  if (coreUnitsPerCard > 0 && availableCore < coreUnitsPerCard) {
    return false;
  }

  return availableMemory > 0 && (coreUnitsPerCard <= 0 || availableCore > 0);
};
