import {
  type AcceleratorSample,
  type GpuAllocation,
  reading,
} from "@/foundation/lib/accelerator-observations";

type ReplicaGroupUsage = {
  actualMiB: number | null;
  /** Percent, 0–100. */
  averageUtilization: number | null;
  /** Percent, 0–100. */
  peakUtilization: number | null;
};

const MEMORY_METRIC = "neutree_endpoint_replica_accelerator_memory_used_bytes";
const UTILIZATION_METRIC =
  "neutree_endpoint_replica_accelerator_utilization_ratio";

const allKnown = (values: Array<number | null>): values is number[] =>
  values.length > 0 && values.every((value) => value != null);

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);

/**
 * A replica's measured usage across its devices. Each figure is reported only
 * when every device has a reading, so a partial total never passes for the
 * whole replica.
 */
export function replicaGroupUsage(
  allocations: GpuAllocation[],
  samples: AcceleratorSample[],
): ReplicaGroupUsage {
  const valuesOf = (metric: string) =>
    allocations.map(
      (allocation) =>
        reading(samples, metric, allocation.node, allocation.uuid, allocation)
          ?.value ?? null,
    );
  const memory = valuesOf(MEMORY_METRIC);
  const utilization = valuesOf(UTILIZATION_METRIC);
  const utilizationKnown = allKnown(utilization);
  return {
    actualMiB: allKnown(memory) ? sum(memory) / 1024 ** 2 : null,
    averageUtilization: utilizationKnown
      ? (sum(utilization) / utilization.length) * 100
      : null,
    peakUtilization: utilizationKnown ? Math.max(...utilization) * 100 : null,
  };
}
