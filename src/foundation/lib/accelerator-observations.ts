import type { EndpointResourceStatus } from "@/foundation/types/resource-types";
import {
  CHART_CATEGORY_COUNT,
  CHART_MAIN_CATEGORY_COUNT,
  CHART_MORE_COLOR,
  chartCategoryMark,
} from "./chart-palette";
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

const sampleKey = (
  metric: string,
  node: string | undefined,
  uuid: string | undefined,
) => `${metric}|${node}|${uuid}`;

const sampleIndexes = new WeakMap<
  AcceleratorSample[],
  Map<string, AcceleratorSample[]>
>();

// Samples grouped by metric, node and card, newest first. A samples response is
// immutable, so the index is built once per response and shared by every card
// that reads from it.
function sampleIndex(samples: AcceleratorSample[]) {
  let index = sampleIndexes.get(samples);
  if (index) return index;
  index = new Map();
  for (const sample of samples) {
    const key = sampleKey(
      sample.metric,
      sample.labels.node,
      sample.labels.accelerator_uuid,
    );
    const list = index.get(key);
    if (list) list.push(sample);
    else index.set(key, [sample]);
  }
  for (const list of index.values())
    list.sort((a, b) => b.observed_at - a.observed_at);
  sampleIndexes.set(samples, index);
  return index;
}

// Generic hardware info first, then vendor-specific metrics so the more
// specific source overrides generic labels.
function deviceHardwareInfo(
  samples: AcceleratorSample[],
  node: string,
  uuid: string,
): Record<string, string> {
  const extensions = [
    ...new Set(
      [...sampleIndex(samples).values()]
        .map((list) => list[0].metric)
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
  const candidates = sampleIndex(samples).get(sampleKey(metric, node, uuid));
  if (!candidates) return undefined;
  if (!allocation) return candidates[0];
  const matching = candidates.filter(({ labels: l }) => {
    return (
      l.endpoint === allocation.endpoint &&
      (allocation.replica
        ? l.replica === allocation.replica
        : l.instance_id === allocation.instance) &&
      (!allocation.vdevice || l.vdevice_index === allocation.vdevice)
    );
  });
  if (
    new Set(
      matching.map(
        (s) =>
          `${s.labels.instance_id}:${s.labels.replica}:${s.labels.vdevice_index}`,
      ),
    ).size > 1
  )
    return undefined;
  return matching[0];
}

export type DeviceReadings = {
  total: number | null;
  actual: number | null;
  utilization: AcceleratorSample | undefined;
  temperature: AcceleratorSample | undefined;
  power: AcceleratorSample | undefined;
  hardware: Record<string, string>;
};

/** What a card shows for one device; replica-scoped where a replica is given. */
export function deviceReadings(
  device: ObservedGpu,
  samples: AcceleratorSample[],
  replica?: GpuAllocation,
): DeviceReadings {
  const getScoped = (name: string) =>
    reading(samples, name, device.node, device.uuid, replica);
  const getDevice = (name: string) =>
    reading(samples, name, device.node, device.uuid);
  const used = getScoped(
    replica ? REPLICA_MEMORY_METRIC : "neutree_accelerator_memory_used_bytes",
  );
  const physical = getDevice("neutree_accelerator_memory_total_bytes");

  return {
    total: physical ? physical.value / 1024 ** 2 : device.totalMiB,
    actual: used ? used.value / 1024 ** 2 : null,
    utilization: getScoped(
      replica
        ? "neutree_endpoint_replica_accelerator_utilization_ratio"
        : "neutree_accelerator_utilization_ratio",
    ),
    temperature: getDevice("neutree_accelerator_temperature_celsius"),
    power: getDevice("neutree_accelerator_power_usage_watts"),
    hardware: deviceHardwareInfo(samples, device.node, device.uuid),
  };
}

/** Each replica's measured memory on the card, and the sum of those known. */
export function replicaUsage(
  samples: AcceleratorSample[],
  allocation: EndpointGpuAllocation,
) {
  const rows = allocation.allocations.map((item) => {
    const sample = reading(
      samples,
      REPLICA_MEMORY_METRIC,
      item.node,
      item.uuid,
      item,
    );
    return { item, usedMiB: sample ? sample.value / 1024 ** 2 : null };
  });
  const known = rows.filter((row) => row.usedMiB != null);
  return {
    rows,
    usedMiB: known.length
      ? known.reduce((sum, row) => sum + (row.usedMiB ?? 0), 0)
      : null,
  };
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

/** Colour of an Endpoint's allocation on a GPU bar.
 *
 * The largest allocation always takes the first colour. The others are hashed
 * by Endpoint name over the remaining solid main colours, so an Endpoint keeps
 * its colour across cards, views and refreshes; the position offset moves two
 * allocations of one name apart. Past the categorical slots the bar folds into
 * the neutral "more" bucket, as the chart palette never recycles a colour.
 */
export function allocationColor(name: string, position: number): string {
  if (position >= CHART_CATEGORY_COUNT) return CHART_MORE_COLOR;
  if (position <= 0) return chartCategoryMark(0).color;
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return chartCategoryMark(
    1 + ((hash + position - 1) % (CHART_MAIN_CATEGORY_COUNT - 1)),
  ).color;
}

type EndpointRef = { workspace: string; endpoint: string };

/** Identity of one Endpoint's allocation within a GPU. */
export const allocationKey = (allocation: EndpointRef) =>
  `${allocation.workspace}:${allocation.endpoint}`;

export const endpointHref = (allocation: EndpointRef) =>
  `/${encodeURIComponent(allocation.workspace)}/endpoints/show/${encodeURIComponent(allocation.endpoint)}`;

/** `value` as a percentage of `total`, clamped to 0–100; 0 without a total. */
export const percentOf = (
  value: number | null | undefined,
  total: number | null | undefined,
) =>
  value == null || !total
    ? 0
    : Math.max(0, Math.min(100, (value / total) * 100));

type Reservation = {
  memoryMiB: number;
  modelWeightsMiB?: number | null;
  kvCacheCapacityMiB?: number | null;
};

/** How a reservation splits into weights, KV cache and the rest, and how much
 * of it is actually in use. Percentages are of the reservation and stack to at
 * most 100; without both weights and KV the split is unknown (`otherMiB` null).
 */
export function allocationComposition(
  allocation: Reservation,
  actualMiB?: number | null,
) {
  const {
    memoryMiB: memory,
    modelWeightsMiB: weights,
    kvCacheCapacityMiB: kv,
  } = allocation;
  const known = weights != null && kv != null;
  const weightsPct = known ? percentOf(weights, memory) : 0;
  const kvPct = known ? Math.min(100 - weightsPct, percentOf(kv, memory)) : 0;
  return {
    weightsPct,
    kvPct,
    otherPct: known && memory > 0 ? Math.max(0, 100 - weightsPct - kvPct) : 0,
    otherMiB: known ? Math.max(0, memory - weights - kv) : null,
    actualPct:
      actualMiB != null && memory > 0 ? percentOf(actualMiB, memory) : null,
  };
}

// Beyond this the values are history, not state: they stay visible with a
// marker rather than being dropped or passed off as live.
const STALE_AFTER_SECONDS = 2 * 60 * 60;

/** Age of the newest of `samples`, or null when none was observed. */
export function sampleAge(
  nowMs: number,
  samples: Array<AcceleratorSample | undefined>,
): { seconds: number; stale: boolean } | null {
  const latest = samples.reduce(
    (max, sample) => Math.max(max, sample?.observed_at ?? 0),
    0,
  );
  if (latest <= 0) return null;
  const seconds = Math.max(0, Math.floor(nowMs / 1000) - latest);
  return { seconds, stale: seconds > STALE_AFTER_SECONDS };
}

/** A hardware label as shown: a flag for link presence, a unit-prefixed PCIe
 * value, or the raw label; null when the exporter has no value for it. */
export function hardwareValue(
  hardware: Record<string, string>,
  key: string,
): string | boolean | null {
  const value = hardware[key];
  if (key === "nvlink" || key === "nvswitch")
    return value === "1" ? true : value === "0" ? false : null;
  if (key === "pcie_generation") return value ? `Gen ${value}` : null;
  if (key === "pcie_width") return value ? `x${value}` : null;
  return !value || value === "unknown" || value === "-1" ? null : value;
}

/** What the replica count of one Endpoint on a card says, if anything. */
export function replicaSummary(
  allocation: EndpointGpuAllocation,
):
  | { kind: "ofTotal"; onCard: number; total: number }
  | { kind: "count"; count: number }
  | { kind: "vgpu"; vdevice: string }
  | null {
  const onCard = allocation.allocations.length;
  const total = allocation.allocations[0]?.endpointReplicas ?? onCard;
  if (total > onCard) return { kind: "ofTotal", onCard, total };
  if (onCard > 1) return { kind: "count", count: onCard };
  const vdevice = allocation.allocations[0]?.vdevice;
  return vdevice ? { kind: "vgpu", vdevice } : null;
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
