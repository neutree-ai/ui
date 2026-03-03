export type TimeoutUnit = "s" | "min";

export function msToDisplayValue(ms: number, unit: TimeoutUnit): number {
  if (unit === "min") return ms / 60000;
  return ms / 1000;
}

export function displayValueToMs(value: number, unit: TimeoutUnit): number {
  if (unit === "min") return value * 60000;
  return value * 1000;
}

export function formatTimeout(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return "-";
  if (ms % 60000 === 0) return `${ms / 60000}min`;
  return `${ms / 1000}s`;
}
