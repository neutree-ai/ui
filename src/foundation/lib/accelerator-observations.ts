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
  /** Replicas this Endpoint runs in total, across every card. */
  endpointReplicas?: number;
  memoryMiB: number;
  modelWeightsMiB?: number | null;
  kvCacheCapacityMiB?: number | null;
};

export type EndpointGpuAllocation = {
  endpoint: string;
  workspace: string;
  model: string;
  memoryMiB: number;
  modelWeightsMiB: number | null;
  kvCacheCapacityMiB: number | null;
  allocations: GpuAllocation[];
};

export type ObservedGpu = {
  node: string;
  uuid: string;
  index: number;
  product: string;
  totalMiB: number | null;
  allocatedMiB: number | null;
  coreUnits?: number | null;
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

function toGpuAllocation(
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
    endpointReplicas: endpoint.status?.resources?.replicas?.length,
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

const REPLICA_MEMORY_METRIC =
  "neutree_endpoint_replica_accelerator_memory_used_bytes";
const HARDWARE_INFO_METRIC = "neutree_node_accelerator_hardware_info";

// Generic hardware info first, then vendor-specific metrics so the more
// specific source overrides generic labels.
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

function allocationUsedMiB(
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

export function endpointAllocationUsedMiB(
  samples: AcceleratorSample[],
  allocation: EndpointGpuAllocation,
  allocationsOnCard: number,
  cardUsedMiB: number | null,
): number | null {
  let total = 0;
  for (const replicaAllocation of allocation.allocations) {
    const usedMiB = allocationUsedMiB(
      samples,
      replicaAllocation,
      allocationsOnCard,
      cardUsedMiB,
    );
    if (usedMiB == null) return null;
    total += usedMiB;
  }
  return total;
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

const PALETTE_SIZE = 8;
const colors = Array.from(
  { length: PALETTE_SIZE },
  (_, index) => `var(--nt-chart-series-${index + 1})`,
);

function allocationColorIndex(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % PALETTE_SIZE;
}

/** Keep an Endpoint's identity colour stable across GPUs and pages.
 *
 * Position in a particular GPU's list must not change an Endpoint's colour,
 * because the same Endpoint would then jump colours whenever a larger
 * allocation appeared on another card. The hash alone can collide though — see
 * assignAllocationColors for the set that has to stay distinguishable.
 *
 * Two Endpoints on *different* cards may share a colour, and that is accepted:
 * the bar exists to separate allocations within one card, and forcing cluster-wide
 * uniqueness would either exhaust the eight-entry palette or move a name every
 * time an unrelated Endpoint appeared elsewhere.
 */
export function allocationColor(name: string): string {
  return colors[allocationColorIndex(name)];
}

/** Colours for the Endpoints sharing one GPU: distinguishable first, stable second.
 *
 * A pure hash is not enough. Names from the same family land on the same entry
 * ("matrix-multi-beta" and "matrix-multi-delta" both hash to series-1), and two
 * segments of one colour in a stacked bar cannot be told apart — which is what
 * the bar is for. Here the hashed colour is only the first choice; on collision
 * the Endpoint walks to the next free entry, so a name moves only when it has to.
 *
 * The input is sorted before assignment, so the same set of Endpoints always
 * resolves to the same mapping whatever order the allocations arrive in; a card
 * with fewer Endpoints never changes another card's colours beyond its own
 * collisions. With more Endpoints than palette entries the extras reuse colours
 * rather than going unpainted.
 */
export function assignAllocationColors(
  names: readonly string[],
): Record<string, string> {
  const unique = [...new Set(names)].sort();
  const taken = new Set<number>();
  const result: Record<string, string> = {};

  for (const name of unique) {
    const preferred = allocationColorIndex(name);
    let index = preferred;
    for (let step = 0; step < PALETTE_SIZE; step += 1) {
      const candidate = (preferred + step) % PALETTE_SIZE;
      if (!taken.has(candidate)) {
        index = candidate;
        break;
      }
    }
    taken.add(index);
    result[name] = colors[index];
  }

  return result;
}

type ObservationStatusValue =
  | "unavailable"
  | "loading"
  | "not_configured"
  | "ok"
  | "no_data";

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

const sumKnown = (
  allocations: GpuAllocation[],
  field: "modelWeightsMiB" | "kvCacheCapacityMiB",
): number | null => {
  let total = 0;
  for (const allocation of allocations) {
    const value = allocation[field];
    if (value == null) return null;
    total += value;
  }
  return total;
};

/** Group replica/device allocations by Endpoint for one GPU. */
export function groupGpuAllocationsByEndpoint(
  allocations: GpuAllocation[],
): EndpointGpuAllocation[] {
  const groups = new Map<string, GpuAllocation[]>();
  for (const allocation of allocations) {
    const key = `${allocation.workspace}\u0000${allocation.endpoint}`;
    groups.set(key, [...(groups.get(key) ?? []), allocation]);
  }

  return [...groups.values()]
    .map((items) => ({
      endpoint: items[0].endpoint,
      workspace: items[0].workspace,
      model: items[0].model,
      memoryMiB: items.reduce((total, item) => total + item.memoryMiB, 0),
      modelWeightsMiB: sumKnown(items, "modelWeightsMiB"),
      kvCacheCapacityMiB: sumKnown(items, "kvCacheCapacityMiB"),
      allocations: items,
    }))
    .sort(
      (left, right) =>
        right.memoryMiB - left.memoryMiB ||
        left.endpoint.localeCompare(right.endpoint),
    );
}

const GPU_ALLOCATION_VISIBLE_LIMIT = 8;

export function splitGpuEndpointAllocations(
  allocations: GpuAllocation[],
  limit = GPU_ALLOCATION_VISIBLE_LIMIT,
) {
  const sorted = groupGpuAllocationsByEndpoint(allocations);
  return {
    sorted,
    visible: sorted.slice(0, limit),
    hidden: sorted.slice(limit),
    hiddenMemoryMiB: sorted
      .slice(limit)
      .reduce((total, allocation) => total + allocation.memoryMiB, 0),
  };
}
