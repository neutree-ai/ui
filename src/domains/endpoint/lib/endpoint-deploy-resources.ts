import type { EndpointClusterRef } from "@/domains/endpoint/types";
import type { ResourceStatus } from "@/foundation/types/resource-types";

/** The cluster of the given name among the loaded clusters. */
export const findEndpointCluster = (
  clusters: EndpointClusterRef[] | undefined,
  name: string,
) => clusters?.find((cluster) => cluster.metadata.name === name);

/** The GPU count step: SSH clusters take tenths of a GPU, others whole GPUs. */
export const gpuCountStep = (cluster: EndpointClusterRef | undefined) =>
  cluster?.spec?.type === "ssh" ? 0.1 : 1;

/** Used as a percentage of total, to one decimal; 0 without a positive total. */
export const toPercentValue = (
  used: number | null | undefined,
  total: number | null | undefined,
) => {
  const numericUsed = Number(used ?? 0);
  const numericTotal = Number(total ?? 0);
  if (!Number.isFinite(numericUsed) || numericTotal <= 0) return 0;

  return Number(((numericUsed / numericTotal) * 100).toFixed(1));
};

/**
 * A CPU or memory pool of a cluster or node: total, available and used
 * (total minus available, never negative), each null when not reported.
 */
export const summarizeResourcePool = (
  status: Partial<ResourceStatus> | null | undefined,
  resource: "cpu" | "memory",
) => {
  const total = status?.allocatable?.[resource] ?? null;
  const available = status?.available?.[resource] ?? null;
  const used =
    total == null || available == null ? null : Math.max(0, total - available);

  return { available, total, used, percent: toPercentValue(used, total) };
};
