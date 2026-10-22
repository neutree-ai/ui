import type { EndpointResourceStatus } from "@/foundation/types/resource-types";

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

export type NodeL1CacheUsage = {
  usedGiB: number | null;
  capacityGiB: number;
};

export function gpuAllocations(
  endpoints: Array<{
    metadata: { name: string; workspace: string | null };
    spec: { model: { name: string } | null };
    status: {
      phase?: string | null;
      resources?: EndpointResourceStatus | null;
    } | null;
  }>,
): GpuAllocation[] {
  return endpoints
    .flatMap((endpoint) => {
      if (
        endpoint.status?.phase === "Paused" ||
        endpoint.status?.phase === "Deleted"
      )
        return [];
      return (endpoint.status?.resources?.replicas ?? []).flatMap((replica) =>
        (replica.devices ?? []).map((device) => ({
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
        })),
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

export function replicaReading(
  samples: AcceleratorSample[],
  metric: string,
  allocation?: GpuAllocation,
): AcceleratorSample | undefined {
  if (!allocation) return undefined;
  const matching = samples.filter((sample) => {
    if (sample.metric !== metric) return false;
    const l = sample.labels;
    const endpointMatch =
      l.endpoint === allocation.endpoint ||
      l.application === allocation.endpoint;
    if (!endpointMatch) return false;
    if (allocation.replica && l.replica) {
      return l.replica === allocation.replica;
    }
    if (allocation.instance && l.instance_id) {
      return l.instance_id === allocation.instance;
    }
    return !l.replica;
  });
  return matching.sort((a, b) => b.observed_at - a.observed_at)[0];
}

export function nodeReading(
  samples: AcceleratorSample[],
  metric: string,
  node: string,
): AcceleratorSample | undefined {
  const matching = samples.filter(
    (sample) => sample.metric === metric && sample.labels.node === node,
  );
  return matching.sort(
    (a, b) => b.value - a.value || b.observed_at - a.observed_at,
  )[0];
}

export function nodeL1CacheByNode(
  cacheNodes:
    | Array<{ node: string; capacity_bytes?: number | null }>
    | null
    | undefined,
  samples: AcceleratorSample[],
): Record<string, NodeL1CacheUsage> {
  const result: Record<string, NodeL1CacheUsage> = {};
  for (const cacheNode of cacheNodes ?? []) {
    const capBytes = cacheNode.capacity_bytes ?? 0;
    if (!cacheNode.node || capBytes <= 0) continue;
    const usedSample = nodeReading(
      samples,
      "lmcache_mp_l1_memory_usage_bytes",
      cacheNode.node,
    );
    result[cacheNode.node] = {
      usedGiB: usedSample != null ? usedSample.value / 1024 ** 3 : null,
      capacityGiB: capBytes / 1024 ** 3,
    };
  }
  return result;
}

const colors = Array.from(
  { length: 3 },
  (_, i) => `var(--nt-chart-series-${[1, 4, 5][i]})`,
);
export function allocationColor(name: string, position = 0): string {
  if (position === 0) return colors[0];
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return colors[1 + (hash + position - 1) % (colors.length - 1)];
}
