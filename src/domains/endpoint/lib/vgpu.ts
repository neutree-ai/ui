import { formatMiBAsGiB } from "@/foundation/lib/unit";
import type { ResourceSpec } from "@/foundation/types/serving-types";

type VgpuVirtualization = NonNullable<
  NonNullable<ResourceSpec["accelerator"]>["virtualization"]
>;

type VgpuAccelerator = NonNullable<ResourceSpec["accelerator"]> &
  Record<string, unknown>;

const MIB_PER_GIB = 1024;

// Resource keys a cluster's accelerator virtualization mode may support,
// matching the backend AcceleratorVirtualizationResourceKey constants.
// The cluster status lists the legal subset in
// status.accelerator_virtualization.supported_resources.
export const VGPU_VIRTUALIZATION_MEMORY_MIB_RESOURCE_KEY =
  "virtualization.memory_mib";
export const VGPU_VIRTUALIZATION_CORE_PERCENT_RESOURCE_KEY =
  "virtualization.core_percent";

/**
 * Whether a virtualization resource is legal under the cluster's effective
 * accelerator virtualization mode. An empty/missing supported-resources list
 * (stale cluster status) falls back to supporting everything, mirroring the
 * backend's shape-only validation fallback.
 */
export function isVgpuVirtualizationResourceSupported(
  supportedResources: string[] | null | undefined,
  resourceKey: string,
): boolean {
  if (!supportedResources || supportedResources.length === 0) {
    return true;
  }
  return supportedResources.includes(resourceKey);
}

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
  rawDisplayBoundaryMiB?: number | null,
): string {
  const memoryMiBValue = toOptionalNumber(memoryMiB);
  if (memoryMiBValue === undefined) return "";

  for (const boundaryMiB of [rawMaxMiB, rawDisplayBoundaryMiB]) {
    const boundaryMiBValue = toOptionalNumber(boundaryMiB);
    if (boundaryMiBValue !== undefined && memoryMiBValue === boundaryMiBValue) {
      return String(getRoundedVgpuMemoryGiBValue(boundaryMiBValue) ?? "");
    }
  }

  return String(getRoundedVgpuMemoryGiBValue(memoryMiBValue) ?? "");
}

export function normalizeVgpuMemoryGiBInput(
  memoryGiB: number,
  rawMaxMiB?: number | null,
  rawDisplayBoundaryMiB?: number | null,
): number | undefined {
  if (!Number.isFinite(memoryGiB)) return undefined;

  const requestedMiB = Math.ceil(memoryGiB * MIB_PER_GIB);
  const boundaries = [rawDisplayBoundaryMiB, rawMaxMiB];

  for (const boundaryMiB of boundaries) {
    const boundaryMiBValue = toOptionalNumber(boundaryMiB);
    const displayBoundaryGiB = getRoundedVgpuMemoryGiBValue(boundaryMiBValue);
    if (
      boundaryMiBValue !== undefined &&
      displayBoundaryGiB !== null &&
      requestedMiB > boundaryMiBValue &&
      memoryGiB <= displayBoundaryGiB
    ) {
      return boundaryMiBValue;
    }
  }

  return requestedMiB;
}

export function normalizeVgpuVirtualization(
  virtualization: VgpuVirtualization | null | undefined,
): VgpuVirtualization | undefined {
  if (!virtualization) return undefined;

  const memoryMiB = toOptionalNumber(virtualization.memory_mib);
  const corePercent = toOptionalNumber(virtualization.core_percent);

  const normalized: VgpuVirtualization = {};
  if (memoryMiB !== undefined && memoryMiB > 0) {
    normalized.memory_mib = memoryMiB;
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
  const hasVirtualMemory = virtualization?.memory_mib !== undefined;

  return Boolean(resources?.accelerator?.type && hasVirtualMemory);
}

export function getEffectiveVgpuMemoryMiB(
  virtualization: VgpuVirtualization | null | undefined,
  _memoryTotalMiB: number | null | undefined,
): number | null {
  const normalized = normalizeVgpuVirtualization(virtualization);
  if (!normalized) return null;
  if (normalized.memory_mib !== undefined) return normalized.memory_mib;
  return null;
}

export function getVgpuMemoryDisplay(
  virtualization: VgpuVirtualization | null | undefined,
  _memoryTotalMiB: number | null | undefined,
): string | null {
  const normalized = normalizeVgpuVirtualization(virtualization);
  if (!normalized) return null;
  if (normalized.memory_mib !== undefined) {
    return formatMiBAsGiB(normalized.memory_mib);
  }
  return null;
}
