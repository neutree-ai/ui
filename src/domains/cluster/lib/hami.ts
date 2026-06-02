import type { Cluster } from "@/domains/cluster/types";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";

type HamiComponentStatus = {
  phase?: string | null;
  managed?: boolean | null;
  version?: string | null;
  reason?: string | null;
  message?: string | null;
};

type VgpuProductRow = {
  acceleratorType: string;
  product: string;
  quantity: number;
  availableQuantity: number;
  memoryTotalMiB?: number | null;
  allocatableVirtualizationMemoryMiB?: number | null;
  availableVirtualizationMemoryMiB?: number | null;
  allocatableCoreUnits?: number | null;
  availableCoreUnits?: number | null;
};

export function isAcceleratorVirtualizationEnabled(
  cluster: Pick<Cluster, "spec"> | null | undefined,
): boolean {
  return cluster?.spec.accelerator_virtualization?.enabled === true;
}

export function getHamiComponentStatus(
  cluster: Pick<Cluster, "status"> | null | undefined,
): HamiComponentStatus | null {
  return cluster?.status?.component_status?.hami ?? null;
}

export function getVgpuProductRows(
  resourceInfo: ClusterResourceInfo | null | undefined,
): VgpuProductRow[] {
  const allocatableGroups = resourceInfo?.allocatable?.accelerator_groups;
  if (!allocatableGroups) return [];

  return Object.entries(allocatableGroups).flatMap(
    ([acceleratorType, allocatableGroup]) => {
      const availableGroup =
        resourceInfo?.available?.accelerator_groups?.[acceleratorType];
      const metadataProducts =
        resourceInfo?.accelerator_metadata?.[acceleratorType]?.products ?? {};

      if (allocatableGroup.products) {
        return Object.entries(allocatableGroup.products).map(
          ([product, allocatableProduct]) => {
            const availableProduct = availableGroup?.products?.[product];
            return {
              acceleratorType,
              product,
              quantity: allocatableProduct.quantity ?? 0,
              availableQuantity: availableProduct?.quantity ?? 0,
              memoryTotalMiB: metadataProducts[product]?.memory_total_mib,
              allocatableVirtualizationMemoryMiB:
                allocatableProduct.virtualization?.memory_mib,
              availableVirtualizationMemoryMiB:
                availableProduct?.virtualization?.memory_mib,
              allocatableCoreUnits:
                allocatableProduct.virtualization?.core_units,
              availableCoreUnits: availableProduct?.virtualization?.core_units,
            };
          },
        );
      }

      return Object.entries(allocatableGroup.product_groups ?? {}).map(
        ([product, quantity]) => ({
          acceleratorType,
          product,
          quantity,
          availableQuantity: availableGroup?.product_groups?.[product] ?? 0,
          memoryTotalMiB: metadataProducts[product]?.memory_total_mib,
        }),
      );
    },
  );
}
