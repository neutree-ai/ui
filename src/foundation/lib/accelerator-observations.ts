import type { EndpointResourceStatus } from "@/foundation/types/resource-types";
import type { AcceleratorExtraField } from "./accelerator-extra-info";
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
  coreUnits?: number | null;
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
  /** Core units still available on the device's resource pool. */
  availableCoreUnits?: number | null;
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
    coreUnits: device.core_units,
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
export function deviceHardwareInfo(
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

/**
 * Device readings inferred from endpoint-scoped samples.
 *
 * SSH clusters do not always expose physical-device memory and utilization.
 * When every allocation on the card has an endpoint-scoped reading, the card's
 * memory usage can be represented as their sum and utilization as the busiest
 * allocation. A partial set stays unknown rather than presenting a misleading
 * device total.
 */
export function allocationFallbackReadings(
  samples: AcceleratorSample[],
  allocations: GpuAllocation[],
): {
  memoryUsedMiB: number | null;
  utilization: AcceleratorSample | undefined;
} {
  if (allocations.length === 0) {
    return { memoryUsedMiB: null, utilization: undefined };
  }

  const memorySamples = allocations.map((allocation) =>
    reading(
      samples,
      REPLICA_MEMORY_METRIC,
      allocation.node,
      allocation.uuid,
      allocation,
    ),
  );
  const utilizationSamples = allocations.map((allocation) =>
    reading(
      samples,
      "neutree_endpoint_replica_accelerator_utilization_ratio",
      allocation.node,
      allocation.uuid,
      allocation,
    ),
  );
  const latestObservedAt = Math.max(
    0,
    ...utilizationSamples.map((sample) => sample?.observed_at ?? 0),
  );
  const knownUtilizations = utilizationSamples.filter(
    (sample): sample is AcceleratorSample => sample != null,
  );
  const busiest =
    knownUtilizations.length === utilizationSamples.length
      ? knownUtilizations.reduce((latest, sample) =>
          sample.value > latest.value ? sample : latest,
        )
      : undefined;

  return {
    memoryUsedMiB: memorySamples.every((sample) => sample != null)
      ? memorySamples.reduce(
          (total, sample) => total + (sample?.value ?? 0) / 1024 ** 2,
          0,
        )
      : null,
    utilization: busiest
      ? { ...busiest, observed_at: latestObservedAt }
      : undefined,
  };
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

type DeviceReadings = {
  total: number | null;
  actual: number | null;
  utilization: AcceleratorSample | undefined;
  temperature: AcceleratorSample | undefined;
  power: AcceleratorSample | undefined;
};

/** What a card shows for one device; replica-scoped where a replica is given.
 *
 * A whole device can be read two ways: its own gauge, or the sum of the
 * Endpoints allocated on it. The card cannot use less than its Endpoints
 * report, so the larger reading wins and utilization follows the same source.
 * Either one stands in when the other is missing. A replica-scoped reading has
 * no such second source.
 */
export function deviceReadings(
  device: ObservedGpu,
  samples: AcceleratorSample[],
  replica?: GpuAllocation,
  allocations: GpuAllocation[] = [],
): DeviceReadings {
  const getScoped = (name: string) =>
    reading(samples, name, device.node, device.uuid, replica);
  const getDevice = (name: string) =>
    reading(samples, name, device.node, device.uuid);
  const used = getScoped(
    replica ? REPLICA_MEMORY_METRIC : "neutree_accelerator_memory_used_bytes",
  );
  const utilization = getScoped(
    replica
      ? "neutree_endpoint_replica_accelerator_utilization_ratio"
      : "neutree_accelerator_utilization_ratio",
  );
  const physical = getDevice("neutree_accelerator_memory_total_bytes");
  const directMiB = used ? used.value / 1024 ** 2 : null;
  const fallback = replica
    ? { memoryUsedMiB: null, utilization: undefined }
    : allocationFallbackReadings(samples, allocations);
  const useFallback =
    fallback.memoryUsedMiB != null &&
    (directMiB == null || fallback.memoryUsedMiB > directMiB);

  return {
    total: physical ? physical.value / 1024 ** 2 : device.totalMiB,
    actual: useFallback ? fallback.memoryUsedMiB : directMiB,
    utilization: useFallback
      ? (fallback.utilization ?? utilization)
      : (utilization ?? fallback.utilization),
    temperature: getDevice("neutree_accelerator_temperature_celsius"),
    power: getDevice("neutree_accelerator_power_usage_watts"),
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

/** Allocated, total and remaining accelerator-core capacity for one device. */
export function coreAllocation(
  total: number | null | undefined,
  available: number | null | undefined,
) {
  if (
    typeof total !== "number" ||
    !Number.isFinite(total) ||
    typeof available !== "number" ||
    !Number.isFinite(available)
  ) {
    return null;
  }

  const normalizedTotal = Math.max(0, total);
  const normalizedAvailable = Math.min(normalizedTotal, Math.max(0, available));
  const allocated = normalizedTotal - normalizedAvailable;

  return {
    allocated,
    total: normalizedTotal,
    available: normalizedAvailable,
    percent: normalizedTotal > 0 ? (allocated / normalizedTotal) * 100 : 0,
  };
}

type Reservation = {
  memoryMiB: number;
  modelWeightsMiB?: number | null;
  kvCacheCapacityMiB?: number | null;
};

/** How a reservation splits into weights, KV cache and the rest, and how much
 * of it is actually in use. Percentages are of the reservation and stack to at
 * most 100; without model weights the split is unknown (`otherMiB` null).
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
  const actualPct =
    actualMiB != null && memory > 0 ? percentOf(actualMiB, memory) : null;
  // The split needs model weights. Without L0 KV, the rest of the reservation
  // still reads as "other" rather than hiding the weights.
  if (weights == null || memory <= 0)
    return {
      known: false,
      weightsPct: 0,
      kvPct: 0,
      otherPct: 0,
      otherMiB: null,
      actualPct,
    };
  const weightsPct = percentOf(weights, memory);
  const kvPct =
    kv == null ? 0 : Math.min(100 - weightsPct, percentOf(kv, memory));
  return {
    known: true,
    weightsPct,
    kvPct,
    otherPct: Math.max(0, 100 - weightsPct - kvPct),
    otherMiB: Math.max(0, memory - weights - (kv ?? 0)),
    actualPct,
  };
}

// Beyond this the values are history, not state: they stay visible with a
// marker rather than being dropped or passed off as live.
const STALE_AFTER_SECONDS = 2 * 60 * 60;

/**
 * Age of the newest of `samples`, or null when none was observed.
 * `observed_at` can carry fractional seconds; floor the elapsed time so display
 * formatting never receives the backend's precision.
 */
export function sampleAge(
  nowMs: number,
  samples: Array<AcceleratorSample | undefined>,
): { seconds: number; stale: boolean } | null {
  const latest = samples.reduce(
    (max, sample) => Math.max(max, sample?.observed_at ?? 0),
    0,
  );
  if (latest <= 0) return null;
  const seconds = Math.max(0, Math.floor(nowMs / 1000 - latest));
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

const NVIDIA_ONLY_HARDWARE_FIELDS = new Set(["nvlink", "nvswitch"]);

/** Report whether the card is an NVIDIA GPU based on product model or CUDA/NVLink labels. */
export function isNvidiaAccelerator(
  product: string,
  hardware: Record<string, string> = {},
): boolean {
  return (
    /nvidia|tesla|quadro|geforce|\b(t4|l4|l20|l40s?|a10|a100|a800|h100|h800|h20|rtx|gtx|4090)\b/i.test(
      product,
    ) ||
    Boolean(
      hardware.cuda_capability ||
        hardware.cuda_driver_version ||
        hardware.nvlink != null ||
        hardware.nvswitch != null,
    )
  );
}

/** Filter hardware fields to those applicable to the current accelerator. */
export function visibleHardwareFields(
  baseFields: readonly string[],
  extraFields: readonly AcceleratorExtraField[],
  product: string,
  hardware: Record<string, string> = {},
): string[] {
  const isNvidia = isNvidiaAccelerator(product, hardware);
  const base = baseFields.filter(
    (key) => !NVIDIA_ONLY_HARDWARE_FIELDS.has(key) || isNvidia,
  );
  const extra = extraFields
    .filter((field) => !field.when || field.when({ product, hardware }))
    .map((field) => field.key);
  return [...base, ...extra];
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
