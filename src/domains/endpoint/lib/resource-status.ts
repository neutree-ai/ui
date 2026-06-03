import type { EndpointResourceStatus } from "@/foundation/types/resource-types";

type EndpointResourceSummaryRow = {
  product: string;
  memoryMiB: number;
  coreUnits: number;
};

type EndpointReplicaResourceRow = {
  instanceId: string;
  replicaId: string;
  nodeId: string;
  uuid: string;
  product: string;
  memoryMiB: number;
  coreUnits: number;
};

export function getEndpointResourceSummaryRows(
  resourceStatus: EndpointResourceStatus | null | undefined,
): EndpointResourceSummaryRow[] {
  return Object.entries(resourceStatus?.summary?.products ?? {})
    .map(([product, usage]) => ({
      product,
      memoryMiB: usage.memory_mib,
      coreUnits: usage.core_units,
    }))
    .sort((a, b) => a.product.localeCompare(b.product));
}

export function getEndpointReplicaResourceRows(
  resourceStatus: EndpointResourceStatus | null | undefined,
): EndpointReplicaResourceRow[] {
  return (resourceStatus?.replicas ?? []).flatMap((replica) =>
    (replica.devices ?? []).map((device) => ({
      instanceId: replica.instance_id,
      replicaId: replica.replica_id ?? "",
      nodeId: device.node_id || replica.node_id || "",
      uuid: device.uuid,
      product: device.product,
      memoryMiB: device.memory_mib,
      coreUnits: device.core_units,
    })),
  );
}
