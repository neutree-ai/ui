import { compareVersions } from "compare-versions";
import type { Cluster } from "@/domains/cluster/types";
import { mergePoolTotals } from "@/foundation/lib/device-resource-utils";
import type {
  AcceleratorProductResources,
  ClusterResourceInfo,
  NodeResourceStatus,
} from "@/foundation/types/resource-types";

const MAX_UNSUPPORTED_ACCELERATOR_VIRTUALIZATION_CLUSTER_VERSION = "v1.0.1";

type AcceleratorProductResourceRow = {
  acceleratorType: string;
  product: string;
  quantity: number;
  availableQuantity: number;
  memoryTotalMiB?: number | null;
  allocatableMemoryMiB?: number | null;
  availableMemoryMiB?: number | null;
  allocatableCoreUnits?: number | null;
  availableCoreUnits?: number | null;
};

const getDevicePoolsByProduct = (
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
) => {
  const result = new Map<
    string,
    {
      memory: { total: number | null; available: number | null };
      core: { total: number | null; available: number | null };
      maxMemoryTotalMiB: number | null;
    }
  >();

  for (const nodeStatus of Object.values(nodeResources ?? {})) {
    for (const device of nodeStatus.devices ?? []) {
      if (!device.health) {
        continue;
      }

      const current = result.get(device.product) ?? {
        memory: { total: null, available: null },
        core: { total: null, available: null },
        maxMemoryTotalMiB: null,
      };
      const memoryTotalMiB = device.allocatable?.memory_mib;

      result.set(device.product, {
        memory: mergePoolTotals(
          current.memory,
          memoryTotalMiB,
          device.available?.memory_mib,
        ),
        core: mergePoolTotals(
          current.core,
          device.allocatable?.core_units,
          device.available?.core_units,
        ),
        maxMemoryTotalMiB:
          memoryTotalMiB == null
            ? current.maxMemoryTotalMiB
            : Math.max(current.maxMemoryTotalMiB ?? 0, memoryTotalMiB),
      });
    }
  }

  return result;
};

const getProductMemoryTotalMiB = (
  metadataMemoryTotalMiB: number | null | undefined,
  productResources: AcceleratorProductResources | undefined,
  deviceMemoryTotalMiB: number | null | undefined,
) => {
  if (Number.isFinite(metadataMemoryTotalMiB)) {
    return metadataMemoryTotalMiB;
  }

  if (Number.isFinite(deviceMemoryTotalMiB)) {
    return deviceMemoryTotalMiB;
  }

  const aggregateMemoryMiB = productResources?.virtualization?.memory_mib;
  const quantity = productResources?.quantity;
  if (
    Number.isFinite(aggregateMemoryMiB) &&
    Number.isFinite(quantity) &&
    Number(quantity) > 0
  ) {
    return Math.ceil(Number(aggregateMemoryMiB) / Number(quantity));
  }

  return undefined;
};

export function isAcceleratorVirtualizationSupported(
  version: string | null | undefined,
): boolean {
  if (!version) {
    return false;
  }

  try {
    return (
      compareVersions(
        version,
        MAX_UNSUPPORTED_ACCELERATOR_VIRTUALIZATION_CLUSTER_VERSION,
      ) > 0
    );
  } catch {
    return false;
  }
}

export function isAcceleratorVirtualizationEnabled(
  cluster: Pick<Cluster, "spec"> | null | undefined,
): boolean {
  return cluster?.spec.accelerator_virtualization?.enabled === true;
}

export function getAcceleratorProductResourceRows(
  resourceInfo: ClusterResourceInfo | null | undefined,
): AcceleratorProductResourceRow[] {
  const allocatableGroups = resourceInfo?.allocatable?.accelerator_groups;
  if (!allocatableGroups) return [];

  const devicePoolsByProduct = getDevicePoolsByProduct(
    resourceInfo?.node_resources,
  );

  return Object.entries(allocatableGroups).flatMap(
    ([acceleratorType, allocatableGroup]) => {
      const availableGroup =
        resourceInfo?.available?.accelerator_groups?.[acceleratorType];
      const metadataProducts =
        resourceInfo?.accelerator_metadata?.[acceleratorType]?.products ?? {};

      const allocatableProducts = allocatableGroup.products;

      if (allocatableProducts && Object.keys(allocatableProducts).length > 0) {
        return Object.entries(allocatableProducts).map(
          ([product, allocatableProduct]) => {
            const availableProduct = availableGroup?.products?.[product];
            const devicePools = devicePoolsByProduct.get(product);
            return {
              acceleratorType,
              product,
              quantity: allocatableProduct.quantity ?? 0,
              availableQuantity: availableProduct?.quantity ?? 0,
              memoryTotalMiB: getProductMemoryTotalMiB(
                metadataProducts[product]?.memory_total_mib,
                allocatableProduct,
                devicePools?.maxMemoryTotalMiB,
              ),
              allocatableMemoryMiB:
                allocatableProduct.virtualization?.memory_mib ??
                devicePools?.memory.total,
              availableMemoryMiB:
                availableProduct?.virtualization?.memory_mib ??
                devicePools?.memory.available,
              allocatableCoreUnits:
                allocatableProduct.virtualization?.core_units ??
                devicePools?.core.total,
              availableCoreUnits:
                availableProduct?.virtualization?.core_units ??
                devicePools?.core.available,
            };
          },
        );
      }

      return Object.entries(allocatableGroup.product_groups ?? {}).map(
        ([product, quantity]) => {
          const devicePools = devicePoolsByProduct.get(product);
          return {
            acceleratorType,
            product,
            quantity,
            availableQuantity: availableGroup?.product_groups?.[product] ?? 0,
            memoryTotalMiB: getProductMemoryTotalMiB(
              metadataProducts[product]?.memory_total_mib,
              undefined,
              devicePools?.maxMemoryTotalMiB,
            ),
            allocatableMemoryMiB: devicePools?.memory.total,
            availableMemoryMiB: devicePools?.memory.available,
            allocatableCoreUnits: devicePools?.core.total,
            availableCoreUnits: devicePools?.core.available,
          };
        },
      );
    },
  );
}
