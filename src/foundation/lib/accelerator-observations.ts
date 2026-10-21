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

const colors = Array.from(
  { length: 5 },
  (_, i) => `var(--nt-chart-series-${i + 1})`,
);
export function allocationColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}
