import type {
  AcceleratorGroup,
  NodeResourceStatus,
} from "@/foundation/types/resource-types";

type NodeDeviceResourceRow = {
  nodeName: string;
  uuid: string;
  product: string;
  healthy: boolean;
  allocatableMemoryMiB: number | null;
  availableMemoryMiB: number | null;
  allocatableCoreUnits: number | null;
  availableCoreUnits: number | null;
  allocatableSlots: number | null;
  availableSlots: number | null;
};

const nullableNumber = (value: number | null | undefined) => value ?? null;

export function getNodeDeviceResourceRows(
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
): NodeDeviceResourceRow[] {
  if (!nodeResources) return [];

  return Object.entries(nodeResources).flatMap(([nodeName, nodeStatus]) =>
    (nodeStatus.devices ?? []).map((device) => ({
      nodeName,
      uuid: device.uuid,
      product: device.product,
      healthy: device.health,
      allocatableMemoryMiB: nullableNumber(device.allocatable?.memory_mib),
      availableMemoryMiB: nullableNumber(device.available?.memory_mib),
      allocatableCoreUnits: nullableNumber(device.allocatable?.core_units),
      availableCoreUnits: nullableNumber(device.available?.core_units),
      allocatableSlots: nullableNumber(device.allocatable?.slots),
      availableSlots: nullableNumber(device.available?.slots),
    })),
  );
}

export function getAcceleratorProductQuantities(
  group: AcceleratorGroup | null | undefined,
): Record<string, number> | null {
  if (group?.product_groups && Object.keys(group.product_groups).length > 0) {
    return group.product_groups;
  }

  if (!group?.products || Object.keys(group.products).length === 0) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(group.products).map(([product, resources]) => [
      product,
      resources.quantity,
    ]),
  );
}
