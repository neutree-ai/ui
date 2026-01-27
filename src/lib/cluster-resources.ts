import type { Cluster, ResourceStatus } from "@/types";

/**
 * Cluster-level resource summary (for display purposes)
 */
export type ClusterResourceSummary = {
  cpu: { available: number; total: number };
  memory: { available: number; total: number };
};

/**
 * Accelerator option for selection dropdown
 */
export type AcceleratorOption = {
  label: string; // Display label: "NVIDIA GPU - Tesla-V100"
  value: string; // Unique value: "nvidia_gpu:Tesla-V100"
  type: string; // Accelerator type: "nvidia_gpu"
  product: string; // Product name: "Tesla-V100"
  available: number; // Cluster-level available (for reference)
  total: number; // Cluster-level total (for reference)
};

/**
 * Single-node max resources for endpoint form
 * Since TP (Tensor Parallelism) requires single-node deployment,
 * the max values should be based on a single node, not cluster totals.
 */
export type SingleNodeMax = {
  nodeName: string;
  cpu: { available: number; total: number };
  memory: { available: number; total: number };
  gpu: { available: number; total: number };
};

/**
 * Result of parsing cluster resources
 */
export type ParsedClusterResources = {
  summary: ClusterResourceSummary | null;
  acceleratorOptions: AcceleratorOption[];
};

/**
 * Parse cluster resources from cluster.status.resource_info
 * Returns cluster-level summary and available accelerator options
 */
export function parseClusterResources(
  cluster: Cluster | undefined,
  translateAcceleratorType: (type: string) => string,
): ParsedClusterResources {
  if (!cluster?.status?.resource_info) {
    return { summary: null, acceleratorOptions: [] };
  }

  const resourceInfo = cluster.status.resource_info;
  const allocatable = resourceInfo.allocatable;
  const available = resourceInfo.available;

  if (!allocatable || !available) {
    return { summary: null, acceleratorOptions: [] };
  }

  const summary: ClusterResourceSummary = {
    cpu: {
      available: available.cpu || 0,
      total: allocatable.cpu || 0,
    },
    memory: {
      available: available.memory || 0,
      total: allocatable.memory || 0,
    },
  };

  // Build accelerator options from accelerator_groups
  const acceleratorOptions: AcceleratorOption[] = [];

  if (allocatable.accelerator_groups) {
    for (const [type, allocatableGroup] of Object.entries(
      allocatable.accelerator_groups,
    )) {
      const availableGroup = available.accelerator_groups?.[type];
      const availableQuantity = availableGroup?.quantity || 0;
      const totalQuantity = allocatableGroup.quantity || 0;

      const translatedType = translateAcceleratorType(type);

      if (allocatableGroup.product_groups) {
        // Create an option for each product
        for (const [product, productTotal] of Object.entries(
          allocatableGroup.product_groups,
        )) {
          const productAvailable =
            availableGroup?.product_groups?.[product] || 0;

          acceleratorOptions.push({
            label: `${translatedType} - ${product}`,
            value: `${type}:${product}`,
            type,
            product,
            available: productAvailable,
            total: productTotal,
          });
        }
      } else {
        // No product breakdown, create a generic option
        acceleratorOptions.push({
          label: translatedType,
          value: `${type}:generic`,
          type,
          product: "",
          available: availableQuantity,
          total: totalQuantity,
        });
      }
    }
  }

  return { summary, acceleratorOptions };
}

/**
 * Find the best node for a given accelerator type:product combination,
 * or the best node for CPU-only inference when no accelerator is specified.
 *
 * Algorithm:
 * When acceleratorType is provided:
 * 1. Find all nodes that have the specified accelerator product
 * 2. From those nodes, find the ones with the maximum GPU count (available)
 * 3. Among nodes with max GPU, use (cpu + memory) as a tiebreaker score
 * 4. Return the resources of the best node (both available and total/allocatable)
 *
 * When acceleratorType is not provided (CPU-only inference):
 * 1. Consider all nodes as candidates (gpu is reported as 0)
 * 2. Select the node with the highest (cpu + memory) available score
 *
 * This is needed because TP (Tensor Parallelism) requires single-node deployment,
 * so the max values should be based on a single node's capacity.
 */
export function findBestNodeForAccelerator(
  nodeResources: Record<string, ResourceStatus> | null | undefined,
  acceleratorType?: string,
  acceleratorProduct?: string,
): SingleNodeMax | null {
  if (!nodeResources) {
    return null;
  }

  const candidateNodes: Array<{
    nodeName: string;
    gpu: { available: number; total: number };
    cpu: { available: number; total: number };
    memory: { available: number; total: number };
  }> = [];

  const hasAccelerator = !!acceleratorType;

  for (const [nodeName, status] of Object.entries(nodeResources)) {
    const available = status.available;
    const allocatable = status.allocatable;
    if (!available) continue;

    if (!hasAccelerator) {
      // CPU-only: all nodes are candidates, gpu = 0
      candidateNodes.push({
        nodeName,
        gpu: { available: 0, total: 0 },
        cpu: {
          available: available.cpu || 0,
          total: allocatable?.cpu || 0,
        },
        memory: {
          available: available.memory || 0,
          total: allocatable?.memory || 0,
        },
      });
      continue;
    }

    // Check if this node has the specified accelerator type and product
    const accGroupAvailable = available.accelerator_groups?.[acceleratorType];
    if (!accGroupAvailable) continue;

    let gpuAvailable = 0;
    let gpuTotal = 0;
    const product = acceleratorProduct || "";

    if (product === "" || product === "generic") {
      // Generic accelerator (no product breakdown)
      gpuAvailable = accGroupAvailable.quantity || 0;
      gpuTotal =
        allocatable?.accelerator_groups?.[acceleratorType]?.quantity || 0;
    } else if (accGroupAvailable.product_groups?.[product] !== undefined) {
      gpuAvailable = accGroupAvailable.product_groups[product];
      gpuTotal =
        allocatable?.accelerator_groups?.[acceleratorType]?.product_groups?.[
          product
        ] || 0;
    } else {
      // This node doesn't have the specified product
      continue;
    }

    candidateNodes.push({
      nodeName,
      gpu: { available: gpuAvailable, total: gpuTotal },
      cpu: {
        available: available.cpu || 0,
        total: allocatable?.cpu || 0,
      },
      memory: {
        available: available.memory || 0,
        total: allocatable?.memory || 0,
      },
    });
  }

  if (candidateNodes.length === 0) {
    return null;
  }

  if (!hasAccelerator) {
    // CPU-only: select by (cpu + memory) score directly
    const bestNode = candidateNodes.reduce((best, current) => {
      const bestScore = best.cpu.available + best.memory.available;
      const currentScore = current.cpu.available + current.memory.available;
      return currentScore > bestScore ? current : best;
    });

    return {
      nodeName: bestNode.nodeName,
      cpu: bestNode.cpu,
      memory: bestNode.memory,
      gpu: bestNode.gpu,
    };
  }

  // Step 2: Find the maximum GPU count among candidates
  const maxGpu = Math.max(...candidateNodes.map((n) => n.gpu.available));

  // Step 3: Filter to nodes with max GPU count
  const topGpuNodes = candidateNodes.filter((n) => n.gpu.available === maxGpu);

  // Step 4: Among top GPU nodes, select by (cpu + memory) score
  const bestNode = topGpuNodes.reduce((best, current) => {
    const bestScore = best.cpu.available + best.memory.available;
    const currentScore = current.cpu.available + current.memory.available;
    return currentScore > bestScore ? current : best;
  });

  return {
    nodeName: bestNode.nodeName,
    cpu: bestNode.cpu,
    memory: bestNode.memory,
    gpu: bestNode.gpu,
  };
}
