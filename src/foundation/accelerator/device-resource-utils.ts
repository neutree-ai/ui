/**
 * Shared pure helpers for accelerator/GPU device resource accounting.
 * Extracted so foundation and the cluster/endpoint domains reuse a single
 * implementation instead of copy-pasted duplicates.
 */

/** Sum a running memory/core pool total, preserving `null` when both sides are null. */
export const mergePoolTotals = (
  current: { total: number | null; available: number | null },
  nextTotal: number | null | undefined,
  nextAvailable: number | null | undefined,
) => ({
  total:
    current.total == null && nextTotal == null
      ? null
      : (current.total ?? 0) + (nextTotal ?? 0),
  available:
    current.available == null && nextAvailable == null
      ? null
      : (current.available ?? 0) + (nextAvailable ?? 0),
});

/** Normalize a device order to a finite number, or `null` when absent/invalid. */
export const getDeviceOrder = (order: number | null | undefined) =>
  typeof order === "number" && Number.isFinite(order) ? order : null;

/** Sort devices by order (nulls last), then by uuid. */
export const compareDevicesByOrderThenUuid = (
  first: { order?: number | null; uuid: string },
  second: { order?: number | null; uuid: string },
) => {
  const firstOrder = getDeviceOrder(first.order);
  const secondOrder = getDeviceOrder(second.order);

  if (firstOrder != null && secondOrder != null) {
    return firstOrder - secondOrder || first.uuid.localeCompare(second.uuid);
  }

  if (firstOrder != null) {
    return -1;
  }

  if (secondOrder != null) {
    return 1;
  }

  return first.uuid.localeCompare(second.uuid);
};
