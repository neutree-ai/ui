import { formatMiBAsGiB } from "@/foundation/lib/unit";
import type { ResourceSpec } from "@/foundation/types/serving-types";

type VgpuVirtualization = NonNullable<
  NonNullable<ResourceSpec["accelerator"]>["virtualization"]
>;

type VgpuAccelerator = NonNullable<ResourceSpec["accelerator"]> &
  Record<string, unknown>;

const MIB_PER_GIB = 1024;

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

export function getRoundedVgpuMemoryGiBValue(
  memoryMiB: number | null | undefined,
  precision = 1,
): number | null {
  const memoryMiBValue = toOptionalNumber(memoryMiB);
  if (memoryMiBValue === undefined) return null;
  return Number((memoryMiBValue / MIB_PER_GIB).toFixed(precision));
}

export function formatVgpuMemoryGiBInputValue(
  memoryMiB: number | null | undefined,
  rawMaxMiB?: number | null,
): string {
  const memoryMiBValue = toOptionalNumber(memoryMiB);
  if (memoryMiBValue === undefined) return "";

  const rawMaxMiBValue = toOptionalNumber(rawMaxMiB);
  if (rawMaxMiBValue !== undefined && memoryMiBValue === rawMaxMiBValue) {
    return String(getRoundedVgpuMemoryGiBValue(rawMaxMiBValue) ?? "");
  }

  return String(memoryMiBValue / MIB_PER_GIB);
}

export function normalizeVgpuMemoryGiBInput(
  memoryGiB: number,
  rawMaxMiB?: number | null,
): number {
  const requestedMiB = Math.ceil(memoryGiB * MIB_PER_GIB);
  const rawMaxMiBValue = toOptionalNumber(rawMaxMiB);
  const displayMaxGiB = getRoundedVgpuMemoryGiBValue(rawMaxMiBValue);

  if (
    rawMaxMiBValue !== undefined &&
    displayMaxGiB !== null &&
    requestedMiB > rawMaxMiBValue &&
    memoryGiB === displayMaxGiB
  ) {
    return rawMaxMiBValue;
  }

  return requestedMiB;
}

export function normalizeVgpuVirtualization(
  virtualization: VgpuVirtualization | null | undefined,
): VgpuVirtualization | undefined {
  if (!virtualization) return undefined;

  const memoryMiB = toOptionalNumber(virtualization.memory_mib);
  const memoryPercent = toOptionalNumber(virtualization.memory_percent);
  const corePercent = toOptionalNumber(virtualization.core_percent);

  const normalized: VgpuVirtualization = {};
  if (memoryMiB !== undefined && memoryMiB > 0) {
    normalized.memory_mib = memoryMiB;
  } else if (memoryPercent !== undefined && memoryPercent > 0) {
    normalized.memory_percent = memoryPercent;
  }
  if (corePercent !== undefined && corePercent > 0) {
    normalized.core_percent = corePercent;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function getVgpuVirtualization(
  accelerator: ResourceSpec["accelerator"] | null | undefined,
): VgpuVirtualization | undefined {
  if (!accelerator) return undefined;

  const acceleratorMap = accelerator as VgpuAccelerator;
  const nested =
    typeof acceleratorMap.virtualization === "object" &&
    acceleratorMap.virtualization !== null
      ? (acceleratorMap.virtualization as Record<string, unknown>)
      : {};

  return normalizeVgpuVirtualization({
    memory_mib: acceleratorMap["virtualization.memory_mib"],
    memory_percent: acceleratorMap["virtualization.memory_percent"],
    core_percent: acceleratorMap["virtualization.core_percent"],
    ...nested,
  } as VgpuVirtualization);
}

export function hasVgpuResources(
  resources: ResourceSpec | null | undefined,
): boolean {
  const virtualization = getVgpuVirtualization(resources?.accelerator);
  const hasVirtualMemory =
    virtualization?.memory_mib !== undefined ||
    virtualization?.memory_percent !== undefined;

  return Boolean(resources?.accelerator?.type && hasVirtualMemory);
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
    return formatMiBAsGiB(normalized.memory_mib);
  }
  if (
    normalized.memory_percent !== undefined &&
    normalized.memory_percent !== null
  ) {
    const effective = getEffectiveVgpuMemoryMiB(normalized, memoryTotalMiB);
    return effective !== null
      ? `${normalized.memory_percent}% (${formatMiBAsGiB(effective)})`
      : `${normalized.memory_percent}%`;
  }
  return null;
}
