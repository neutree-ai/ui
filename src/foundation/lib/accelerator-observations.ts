import type { EndpointResourceStatus } from "@/foundation/types/resource-types";
import { formatToDecimal } from "./unit";

export type AcceleratorSample = {
  metric: string;
  labels: Record<string, string>;
  value: number;
  observed_at: number;
};
export type AcceleratorSnapshot = {
  status: "ok" | "no_data" | "not_configured";
  samples: AcceleratorSample[];
};
export type GpuAllocation = {
  endpoint: string;
  model: string;
  workspace: string;
  node: string;
  uuid: string;
  replica: string;
  instance: string;
  vdevice?: string;
  memoryMiB: number;
  modelWeightsMiB?: number | null;
  kvCacheCapacityMiB?: number | null;
};

export type ObservedGpu = {
  node: string;
  uuid: string;
  index: number;
  product: string;
  totalMiB: number | null;
  allocatedMiB: number | null;
  healthy?: boolean;
  peakFP16TFLOPS?: number | null;
};

export type NodeL1CacheUsage = {
  usedGiB: number | null;
  capacityGiB: number;
};

type AllocationEndpoint = {
  metadata: { name: string; workspace: string | null };
  spec: { model: { name: string } | null };
  status: {
    phase?: string | null;
    resources?: EndpointResourceStatus | null;
  } | null;
};
type ReplicaStatus = NonNullable<EndpointResourceStatus["replicas"]>[number];

// The identity reading() matches a replica's samples on: endpoint, replica or
// instance, and vGPU slice.
export function toGpuAllocation(
  endpoint: AllocationEndpoint,
  replica: ReplicaStatus,
  device: NonNullable<ReplicaStatus["devices"]>[number],
): GpuAllocation {
  return {
    endpoint: endpoint.metadata.name,
    workspace: endpoint.metadata.workspace ?? "default",
    model: endpoint.spec.model?.name ?? "",
    node: device.node_id || replica.node_id || "",
    uuid: device.uuid,
    replica: replica.replica_id ?? "",
    instance: replica.instance_id,
    vdevice: device.vdevice_index ?? undefined,
    memoryMiB: device.memory_mib,
    modelWeightsMiB: replica.model_weights_mib ?? null,
    kvCacheCapacityMiB: replica.kv_cache_capacity_mib ?? null,
  };
}

export function gpuAllocations(
  endpoints: AllocationEndpoint[],
): GpuAllocation[] {
  return endpoints
    .flatMap((endpoint) => {
      if (
        endpoint.status?.phase === "Paused" ||
        endpoint.status?.phase === "Deleted"
      )
        return [];
      return (endpoint.status?.resources?.replicas ?? []).flatMap((replica) =>
        (replica.devices ?? []).map((device) =>
          toGpuAllocation(endpoint, replica, device),
        ),
      );
    })
    .sort(
      (a, b) =>
        b.memoryMiB - a.memoryMiB ||
        a.endpoint.localeCompare(b.endpoint) ||
        a.instance.localeCompare(b.instance),
    );
}

// Never add duplicate scrape targets or attribute a whole shared card to a replica.
// Ambiguous identities intentionally have no reading.
export function reading(
  samples: AcceleratorSample[],
  metric: string,
  node: string,
  uuid: string,
  allocation?: GpuAllocation,
): AcceleratorSample | undefined {
  const matching = samples.filter((sample) => {
    const l = sample.labels;
    return (
      sample.metric === metric &&
      l.node === node &&
      l.accelerator_uuid === uuid &&
      (!allocation ||
        (l.endpoint === allocation.endpoint &&
          (allocation.replica
            ? l.replica === allocation.replica
            : l.instance_id === allocation.instance) &&
          (!allocation.vdevice || l.vdevice_index === allocation.vdevice)))
    );
  });
  if (
    allocation &&
    new Set(
      matching.map(
        (s) =>
          `${s.labels.instance_id}:${s.labels.replica}:${s.labels.vdevice_index}`,
      ),
    ).size > 1
  )
    return undefined;
  return matching.sort((a, b) => b.observed_at - a.observed_at)[0];
}

const REPLICA_MEMORY_METRIC =
  "neutree_endpoint_replica_accelerator_memory_used_bytes";
const HARDWARE_INFO_METRIC = "neutree_node_accelerator_hardware_info";

// The generic hardware info first, then each vendor or extension info metric in
// name order, so a more specific source overrides the generic labels.
export function deviceHardwareInfo(
  samples: AcceleratorSample[],
  node: string,
  uuid: string,
): Record<string, string> {
  const extensions = [
    ...new Set(
      samples
        .map((sample) => sample.metric)
        .filter(
          (metric) =>
            /^neutree_node_accelerator_.+_info$/.test(metric) &&
            metric !== HARDWARE_INFO_METRIC,
        ),
    ),
  ].sort();
  return Object.assign(
    {},
    ...[HARDWARE_INFO_METRIC, ...extensions].map(
      (metric) => reading(samples, metric, node, uuid)?.labels ?? {},
    ),
  );
}

export function hasAllocationReading(
  samples: AcceleratorSample[],
  allocation: GpuAllocation,
): boolean {
  return Boolean(
    reading(
      samples,
      REPLICA_MEMORY_METRIC,
      allocation.node,
      allocation.uuid,
      allocation,
    ),
  );
}

// A replica's own measurement when there is one. A card with a single
// allocation attributes the whole-card measurement to it; a shared card has no
// way to split it, so the usage stays unknown.
export function allocationUsedMiB(
  samples: AcceleratorSample[],
  allocation: GpuAllocation,
  allocationsOnCard: number,
  cardUsedMiB: number | null,
): number | null {
  const measured = reading(
    samples,
    REPLICA_MEMORY_METRIC,
    allocation.node,
    allocation.uuid,
    allocation,
  );
  if (measured) return measured.value / 1024 ** 2;
  return allocationsOnCard === 1 ? cardUsedMiB : null;
}

export function nodeReading(
  samples: AcceleratorSample[],
  metric: string,
  node: string,
): AcceleratorSample | undefined {
  const matching = samples.filter(
    (sample) => sample.metric === metric && sample.labels.node === node,
  );
  return matching.sort((a, b) => b.observed_at - a.observed_at)[0];
}

export function nodeL1CacheByNode(
  cacheNodes:
    | Array<{ name: string; capacity_bytes?: number | null }>
    | null
    | undefined,
  samples: AcceleratorSample[],
): Record<string, NodeL1CacheUsage> {
  const result: Record<string, NodeL1CacheUsage> = {};
  for (const cacheNode of cacheNodes ?? []) {
    const capBytes = cacheNode.capacity_bytes ?? 0;
    if (!cacheNode.name || capBytes <= 0) continue;
    const usedSample = nodeReading(
      samples,
      "neutree_cache_l1_memory_used_bytes",
      cacheNode.name,
    );
    result[cacheNode.name] = {
      usedGiB: usedSample != null ? usedSample.value / 1024 ** 3 : null,
      capacityGiB: capBytes / 1024 ** 3,
    };
  }
  return result;
}

const colors = [
  "var(--nt-chart-series-1)",
  "var(--nt-chart-series-4)",
  "var(--nt-chart-series-5)",
];
export function allocationColor(name: string, position = 0): string {
  if (position === 0) return colors[0];
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return colors[1 + ((hash + position - 1) % (colors.length - 1))];
}

type ObservationStatusValue =
  | "unavailable"
  | "loading"
  | "not_configured"
  | "ok"
  | "no_data";

// The status line shared by every observation query: a failed request first,
// then loading, then a backend without a query service, then whether any value
// came back.
export function observationStatus(
  failed: boolean,
  loading: boolean,
  reported: string | undefined,
  hasData: boolean,
): ObservationStatusValue {
  if (failed) return "unavailable";
  if (loading) return "loading";
  if (reported === "not_configured") return "not_configured";
  return hasData ? "ok" : "no_data";
}

export function formatL1CacheUsage(usage: NodeL1CacheUsage): string {
  return `${formatToDecimal(usage.usedGiB, 1) ?? "—"} / ${formatToDecimal(usage.capacityGiB, 1)} GiB`;
}
