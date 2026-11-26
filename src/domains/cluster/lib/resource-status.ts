import type {
  AcceleratorGroup,
  DeviceResource,
  NodeResourceStatus,
  ResourceStatus,
} from "@/foundation/types/resource-types";
import { calcResourceUsage } from "./calc-resource-usage";

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

/** A node reports devices or a positive accelerator quantity. */
export function nodeHasAccelerators(node: NodeResourceStatus): boolean {
  return (
    (node.devices?.length ?? 0) > 0 ||
    Object.values(node.allocatable?.accelerator_groups ?? {}).some(
      (group) => group.quantity > 0,
    )
  );
}

/** Nodes open in the resources table at first: those with a healthy device. */
export const nodeHasHealthyDevice = (node: NodeResourceStatus) =>
  (node.devices ?? []).some((device) => device.health);

/** CPU and memory of one node as used out of allocatable; missing allocatable counts as 0. */
export function nodeUsage(node: NodeResourceStatus) {
  const cpuTotal = node.allocatable?.cpu || 0;
  const memoryTotal = node.allocatable?.memory || 0;
  return {
    cpu: {
      total: cpuTotal,
      ...calcResourceUsage(cpuTotal, node.available?.cpu),
    },
    memory: {
      total: memoryTotal,
      ...calcResourceUsage(memoryTotal, node.available?.memory),
    },
  };
}

/** Device rows name their product only when a node mixes products. */
export const mixesDeviceProducts = (devices: DeviceResource[]) =>
  new Set(devices.map((device) => device.product).filter(Boolean)).size > 1;

/** One accelerator type's groups on a node or cluster, as allocatable and available. */
export function acceleratorGroups(status: ResourceStatus, type: string) {
  const allocatable = status.allocatable?.accelerator_groups?.[type];
  return {
    allocatable,
    available: status.available?.accelerator_groups?.[type],
    quantity: allocatable?.quantity || 0,
  };
}

/**
 * Whole accelerator cards in a cluster. A missing accelerator type leaves the
 * available count unknown; the API omits a present group's zero quantity, so
 * that specific shape means zero. Fractional quantities need a continuous meter.
 */
export function acceleratorCardCounts(status: ResourceStatus) {
  const groups = status.allocatable?.accelerator_groups ?? {};
  const availableGroups = status.available?.accelerator_groups;
  const total = Object.values(groups).reduce(
    (sum, group) => sum + group.quantity,
    0,
  );
  const available = Object.keys(groups).reduce<number | null>((sum, type) => {
    const group = availableGroups?.[type];
    return sum == null || group == null ? null : sum + (group.quantity ?? 0);
  }, 0);
  const fractional =
    Object.values(groups).some((group) => !Number.isInteger(group.quantity)) ||
    Object.keys(groups).some((type) => {
      const quantity = availableGroups?.[type]?.quantity;
      return quantity != null && !Number.isInteger(quantity);
    });
  return {
    total,
    available,
    discrete:
      !fractional &&
      Number.isInteger(total) &&
      (available == null || Number.isInteger(available)),
  };
}
