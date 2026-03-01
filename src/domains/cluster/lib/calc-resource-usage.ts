/**
 * Calculate resource usage from allocatable and available values.
 * Returns the used amount and usage percentage (0-100, rounded).
 */
export function calcResourceUsage(
  allocatable: number,
  available?: number,
): { used: number; percent: number } {
  const used = allocatable - (available || 0);
  const percent = allocatable > 0 ? Math.round((used / allocatable) * 100) : 0;
  return { used, percent };
}
