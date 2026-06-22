import { countFullCardAvailableDevicesByProduct } from "@/foundation/lib/gpu-device-resources";
import type {
  AcceleratorProductResources,
  ClusterResourceInfo,
  NodeResourceStatus,
} from "@/foundation/types/resource-types";

/**
 * Cluster-level resource summary (for display purposes)
 */
type ClusterResourceSummary = {
  cpu: { available: number; total: number };
  memory: { available: number; total: number };
};

/**
 * Accelerator option for selection dropdown
 */
type AcceleratorOption = {
  label: string; // Display label: "NVIDIA GPU - Tesla-V100"
  value: string; // Unique value: "nvidia_gpu:Tesla-V100"
  type: string; // Accelerator type: "nvidia_gpu"
  product: string; // Product name: "Tesla-V100"
  available: number; // Cluster-level available (for reference)
  total: number; // Cluster-level total (for reference)
  memoryTotalMiB?: number | null;
  virtualizationMemoryMiB?: number | null;
  virtualizationCoreUnits?: number | null;
};

/**
 * Single-node max resources for endpoint form
 * Since TP (Tensor Parallelism) requires single-node deployment,
 * the max values should be based on a single node, not cluster totals.
 */
type SingleNodeMax = {
  nodeName: string;
  cpu: { available: number; total: number };
  memory: { available: number; total: number };
  gpu: { available: number; total: number };
};

/**
 * Result of parsing cluster resources
 */
type ParsedClusterResources = {
  summary: ClusterResourceSummary | null;
  acceleratorOptions: AcceleratorOption[];
};

const isFiniteNumber = (value: number | null | undefined): value is number =>
  Number.isFinite(value);

const withAcceleratorMetrics = (
  option: Omit<
    AcceleratorOption,
    "memoryTotalMiB" | "virtualizationMemoryMiB" | "virtualizationCoreUnits"
  >,
  metrics: Pick<
    AcceleratorOption,
    "memoryTotalMiB" | "virtualizationMemoryMiB" | "virtualizationCoreUnits"
  >,
): AcceleratorOption => {
  const next: AcceleratorOption = { ...option };

  if (isFiniteNumber(metrics.memoryTotalMiB)) {
    next.memoryTotalMiB = metrics.memoryTotalMiB;
  }
  if (isFiniteNumber(metrics.virtualizationMemoryMiB)) {
    next.virtualizationMemoryMiB = metrics.virtualizationMemoryMiB;
  }
  if (isFiniteNumber(metrics.virtualizationCoreUnits)) {
    next.virtualizationCoreUnits = metrics.virtualizationCoreUnits;
  }

  return next;
};

const getProductDeviceMemoryTotalMiB = (
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  product: string,
) => {
  const memoryValues = Object.values(nodeResources ?? {})
    .flatMap((nodeStatus) => nodeStatus.devices ?? [])
    .filter((device) => device.product === product)
    .map((device) => device.allocatable?.memory_mib)
    .filter((memoryMiB): memoryMiB is number => Number.isFinite(memoryMiB));

  if (memoryValues.length === 0) {
    return undefined;
  }

  return Math.max(...memoryValues);
};

const getProductMemoryTotalMiB = (
  resourceInfo: ClusterResourceInfo,
  type: string,
  product: string,
  productResources?: AcceleratorProductResources,
) => {
  const metadataMemoryTotalMiB =
    resourceInfo.accelerator_metadata?.[type]?.products?.[product]
      ?.memory_total_mib;
  if (Number.isFinite(metadataMemoryTotalMiB)) {
    return metadataMemoryTotalMiB;
  }

  const deviceMemoryTotalMiB = getProductDeviceMemoryTotalMiB(
    resourceInfo.node_resources,
    product,
  );
  if (Number.isFinite(deviceMemoryTotalMiB)) {
    return deviceMemoryTotalMiB;
  }

  const aggregateMemoryMiB = productResources?.virtualization?.memory_mib;
  const quantity = productResources?.quantity;
  if (
    Number.isFinite(aggregateMemoryMiB) &&
    Number.isFinite(quantity) &&
    Number(quantity) > 0
  ) {
    return Math.ceil(Number(aggregateMemoryMiB) / Number(quantity));
  }

  return undefined;
};

/**
 * Parse cluster resource info into a summary and available accelerator options.
 */
export function parseClusterResources(
  resourceInfo: ClusterResourceInfo | null | undefined,
  translateAcceleratorType: (type: string) => string,
): ParsedClusterResources {
  if (!resourceInfo) {
    return { summary: null, acceleratorOptions: [] };
  }

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

      const allocatableProducts = allocatableGroup.products;

      if (allocatableProducts && Object.keys(allocatableProducts).length > 0) {
        for (const [product, productResources] of Object.entries(
          allocatableProducts,
        )) {
          const availableProduct = availableGroup?.products?.[product];

          acceleratorOptions.push(
            withAcceleratorMetrics(
              {
                label: `${translatedType} - ${product}`,
                value: `${type}:${product}`,
                type,
                product,
                available: availableProduct?.quantity || 0,
                total: productResources.quantity || 0,
              },
              {
                memoryTotalMiB: getProductMemoryTotalMiB(
                  resourceInfo,
                  type,
                  product,
                  productResources,
                ),
                virtualizationMemoryMiB:
                  availableProduct?.virtualization?.memory_mib,
                virtualizationCoreUnits:
                  availableProduct?.virtualization?.core_units,
              },
            ),
          );
        }
      } else if (allocatableGroup.product_groups) {
        // Create an option for each product
        for (const [product, productTotal] of Object.entries(
          allocatableGroup.product_groups,
        )) {
          const productAvailable =
            availableGroup?.product_groups?.[product] || 0;

          acceleratorOptions.push(
            withAcceleratorMetrics(
              {
                label: `${translatedType} - ${product}`,
                value: `${type}:${product}`,
                type,
                product,
                available: productAvailable,
                total: productTotal,
              },
              {
                memoryTotalMiB: getProductMemoryTotalMiB(
                  resourceInfo,
                  type,
                  product,
                ),
              },
            ),
          );
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
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
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
    const allocatableAccGroup =
      allocatable?.accelerator_groups?.[acceleratorType];
    const fullCardAvailableDevices = countFullCardAvailableDevicesByProduct({
      [nodeName]: status,
    }).get(product);

    if (product === "" || product === "generic") {
      // Generic accelerator (no product breakdown)
      gpuAvailable = accGroupAvailable.quantity || 0;
      gpuTotal = allocatableAccGroup?.quantity || 0;
    } else if (
      accGroupAvailable.products?.[product] !== undefined ||
      allocatableAccGroup?.products?.[product] !== undefined
    ) {
      gpuAvailable =
        fullCardAvailableDevices ??
        accGroupAvailable.products?.[product]?.quantity ??
        0;
      gpuTotal = allocatableAccGroup?.products?.[product]?.quantity ?? 0;
    } else if (
      accGroupAvailable.product_groups?.[product] !== undefined ||
      allocatableAccGroup?.product_groups?.[product] !== undefined
    ) {
      gpuAvailable =
        fullCardAvailableDevices ??
        accGroupAvailable.product_groups?.[product] ??
        0;
      gpuTotal = allocatableAccGroup?.product_groups?.[product] ?? 0;
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
