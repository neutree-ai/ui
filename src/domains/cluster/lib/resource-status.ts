import type { AcceleratorGroup } from "@/foundation/types/resource-types";

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
