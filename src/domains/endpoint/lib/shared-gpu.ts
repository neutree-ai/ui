/**
 * Memory other Endpoints reserve on a GPU the current Endpoint occupies. When
 * the reservations together exceed physical VRAM the allocation data cannot be
 * trusted, so the other reservations are dropped instead of being drawn past
 * the GPU's capacity.
 */
export function otherGpuReservation(
  physicalMiB: number | null | undefined,
  endpointReservedMiB: number,
  otherReservedMiB: number,
): { reservedMiB: number; inconsistent: boolean } {
  const inconsistent =
    physicalMiB != null &&
    physicalMiB > 0 &&
    endpointReservedMiB + otherReservedMiB > physicalMiB;
  return { reservedMiB: inconsistent ? 0 : otherReservedMiB, inconsistent };
}
