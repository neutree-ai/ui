import type { EndpointResourceRequestContext } from "@/domains/endpoint/lib/gpu-usability";

/**
 * A replica request for 1 CPU and 1 GiB of memory in `allocationMode`, with
 * every capacity figure zeroed. `overrides` set the fields a test is about.
 */
export const makeResourceRequest = (
  allocationMode: EndpointResourceRequestContext["allocationMode"],
  overrides: Partial<EndpointResourceRequestContext> = {},
): EndpointResourceRequestContext => ({
  allocationMode,
  cpuPerReplica: 1,
  memoryPerReplica: 1,
  requestedFullGpuCards: 0,
  fullGpuCardCapacity: 0,
  fullGpuCapacityExceeded: false,
  requestedVirtualCards: 0,
  totalVirtualCardCapacity: 0,
  requestedVgpuMemoryMiB: 0,
  availableVgpuMemoryMiB: 0,
  requestedVgpuCoreUnits: 0,
  availableVgpuCoreUnits: 0,
  vgpuCapacityExceeded: false,
  ...overrides,
});
