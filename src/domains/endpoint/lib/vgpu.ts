import type { ResourceSpec } from "@/foundation/types/serving-types";

type VgpuVirtualization = NonNullable<
  NonNullable<ResourceSpec["accelerator"]>["virtualization"]
>;

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

export function normalizeVgpuVirtualization(
  virtualization: VgpuVirtualization | null | undefined,
): VgpuVirtualization | undefined {
  if (!virtualization) return undefined;

  const memoryMiB = toOptionalNumber(virtualization.memory_mib);
  const memoryPercent = toOptionalNumber(virtualization.memory_percent);
  const corePercent = toOptionalNumber(virtualization.core_percent);

  const normalized: VgpuVirtualization = {};
  if (memoryMiB !== undefined) {
    normalized.memory_mib = memoryMiB;
  } else if (memoryPercent !== undefined) {
    normalized.memory_percent = memoryPercent;
  }
  if (corePercent !== undefined) {
    normalized.core_percent = corePercent;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function hasVgpuResources(
  resources: ResourceSpec | null | undefined,
): boolean {
  const virtualization = normalizeVgpuVirtualization(
    resources?.accelerator?.virtualization,
  );
  return Boolean(resources?.accelerator?.type && virtualization);
}

export function getEffectiveVgpuMemoryMiB(
  virtualization: VgpuVirtualization | null | undefined,
  memoryTotalMiB: number | null | undefined,
): number | null {
  const normalized = normalizeVgpuVirtualization(virtualization);
  if (!normalized) return null;
  if (normalized.memory_mib !== undefined) return normalized.memory_mib;
  const memoryPercent = normalized.memory_percent;
  if (
    memoryPercent !== undefined &&
    memoryPercent !== null &&
    memoryTotalMiB !== null &&
    memoryTotalMiB !== undefined
  ) {
    return Math.ceil((memoryTotalMiB * memoryPercent) / 100);
  }
  return null;
}

export function getVgpuMemoryDisplay(
  virtualization: VgpuVirtualization | null | undefined,
  memoryTotalMiB: number | null | undefined,
): string | null {
  const normalized = normalizeVgpuVirtualization(virtualization);
  if (!normalized) return null;
  if (normalized.memory_mib !== undefined) {
    return `${normalized.memory_mib} MiB`;
  }
  if (
    normalized.memory_percent !== undefined &&
    normalized.memory_percent !== null
  ) {
    const effective = getEffectiveVgpuMemoryMiB(normalized, memoryTotalMiB);
    return effective !== null
      ? `${normalized.memory_percent}% (${effective} MiB)`
      : `${normalized.memory_percent}%`;
  }
  return null;
}
