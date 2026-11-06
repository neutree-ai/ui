import type { ObservedGpu } from "@/foundation/lib/accelerator-observations";
import type { DeviceResource } from "@/foundation/types/resource-types";

/**
 * The inventory view of one node device. Allocated memory is what the pool
 * no longer has available, floored at zero; it is unknown unless both pool
 * sizes are reported.
 */
export function observedGpuFromDevice(
  nodeName: string,
  device: DeviceResource,
  index: number,
): ObservedGpu {
  const total = device.allocatable?.memory_mib;
  const available = device.available?.memory_mib;
  return {
    node: nodeName,
    uuid: device.uuid,
    index: device.order ?? index + 1,
    product: device.product,
    totalMiB: total ?? null,
    allocatedMiB:
      total != null && available != null
        ? Math.max(0, total - available)
        : null,
    coreUnits: device.allocatable?.core_units,
    healthy: device.health,
  };
}
