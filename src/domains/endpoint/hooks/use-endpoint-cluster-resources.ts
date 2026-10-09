import { useMemo } from "react";
import {
  findBestNodeForAccelerator,
  parseClusterResources,
} from "@/domains/endpoint/lib/cluster-resources";
import { computeMaxAvailable } from "@/domains/endpoint/lib/endpoint-form-helpers";
import type { EndpointClusterRef } from "@/domains/endpoint/types";
import type {
  NodeResourceStatus,
  ResourceInfo,
} from "@/foundation/types/resource-types";

// Sum only the eligible nodes; keeping cluster-wide totals would overstate
// capacity when inference must colocate with a node-local cache.
function cachePoolResources(
  nodes: Record<string, NodeResourceStatus>,
  field: "allocatable" | "available",
): ResourceInfo {
  const groups: NonNullable<ResourceInfo["accelerator_groups"]> = {};
  const total: ResourceInfo = { cpu: 0, memory: 0, accelerator_groups: groups };
  for (const node of Object.values(nodes)) {
    const resource = node[field];
    total.cpu += resource?.cpu ?? 0;
    total.memory += resource?.memory ?? 0;
    for (const [type, group] of Object.entries(
      resource?.accelerator_groups ?? {},
    )) {
      const sum = groups[type] ?? {
        quantity: 0,
        product_groups: {},
        products: {},
      };
      groups[type] = sum;
      sum.product_groups ??= {};
      sum.products ??= {};
      sum.quantity += group.quantity ?? 0;
      for (const [product, count] of Object.entries(
        group.product_groups ?? {},
      )) {
        sum.product_groups[product] =
          (sum.product_groups[product] ?? 0) + count;
      }
      for (const [product, value] of Object.entries(group.products ?? {})) {
        const accumulated = sum.products[product] ?? { quantity: 0 };
        sum.products[product] = accumulated;
        accumulated.quantity += value.quantity ?? 0;
        if (value.virtualization) {
          accumulated.virtualization ??= { memory_mib: 0, core_units: 0 };
          accumulated.virtualization.memory_mib =
            (accumulated.virtualization.memory_mib ?? 0) +
            (value.virtualization.memory_mib ?? 0);
          accumulated.virtualization.core_units =
            (accumulated.virtualization.core_units ?? 0) +
            (value.virtualization.core_units ?? 0);
        }
      }
    }
  }
  return total;
}

interface UseEndpointClusterResourcesProps {
  currentCluster: string;
  cacheEnabled?: boolean;
  clustersData: EndpointClusterRef[] | undefined;
  selectedAccelerator: { type: string; product: string } | null | undefined;
  currentUsage: { cpu: number; memory: number; gpu: number };
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function useEndpointClusterResources({
  currentCluster,
  cacheEnabled = false,
  clustersData,
  selectedAccelerator,
  currentUsage,
  t,
}: UseEndpointClusterResourcesProps) {
  const selectedCluster = useMemo(() => {
    if (!currentCluster || !clustersData) {
      return undefined;
    }
    const cluster = clustersData.find(
      (opt) => opt.metadata.name === currentCluster,
    );
    if (!cluster || !cacheEnabled || !cluster.status?.resource_info)
      return cluster;
    const names = new Set(cluster.spec.zcache?.target_nodes ?? []);
    const nodes = Object.fromEntries(
      Object.entries(cluster.status.resource_info.node_resources ?? {}).filter(
        ([name]) => names.has(name),
      ),
    );
    return {
      ...cluster,
      status: {
        ...cluster.status,
        resource_info: {
          ...cluster.status.resource_info,
          node_resources: nodes,
          allocatable: cachePoolResources(nodes, "allocatable"),
          available: cachePoolResources(nodes, "available"),
        },
      },
    };
  }, [currentCluster, clustersData, cacheEnabled]);

  const { summary: clusterResources, acceleratorOptions } = useMemo(() => {
    return parseClusterResources(
      selectedCluster?.status?.resource_info,
      (type) => t(`clusters.acceleratorTypes.${type}`, { defaultValue: type }),
    );
  }, [selectedCluster, t]);

  const singleNodeMax = useMemo(() => {
    if (!selectedCluster?.status?.resource_info) {
      return null;
    }
    return findBestNodeForAccelerator(
      selectedCluster.status.resource_info.node_resources,
      selectedAccelerator?.type || undefined,
      selectedAccelerator?.product || undefined,
    );
  }, [selectedAccelerator, selectedCluster]);

  const selectedAcceleratorOption = useMemo(() => {
    if (!selectedAccelerator) return undefined;
    return acceleratorOptions.find(
      (option) =>
        option.type === selectedAccelerator.type &&
        option.product === selectedAccelerator.product,
    );
  }, [acceleratorOptions, selectedAccelerator]);

  const maxAvailable = useMemo(
    () => computeMaxAvailable(singleNodeMax, clusterResources, currentUsage),
    [singleNodeMax, clusterResources, currentUsage],
  );

  const gpuStep = useMemo(() => {
    const clusterType = selectedCluster?.spec?.type;
    return clusterType === "ssh" ? 0.1 : 1;
  }, [selectedCluster?.spec?.type]);

  return {
    selectedCluster,
    clusterResources,
    acceleratorOptions,
    selectedAcceleratorOption,
    maxAvailable,
    gpuStep,
  };
}
