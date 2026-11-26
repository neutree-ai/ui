import { useMemo } from "react";
import {
  cachePoolResources,
  findBestNodeForAccelerator,
  parseClusterResources,
} from "@/domains/endpoint/lib/cluster-resources";
import {
  findEndpointCluster,
  gpuCountStep,
} from "@/domains/endpoint/lib/endpoint-deploy-resources";
import { computeMaxAvailable } from "@/domains/endpoint/lib/endpoint-form-helpers";
import { endpointZCacheOptions } from "@/domains/endpoint/lib/zcache";
import type { EndpointClusterRef } from "@/domains/endpoint/types";

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
  const selectedCluster = findEndpointCluster(clustersData, currentCluster);
  const schedulingResourceInfo = useMemo(() => {
    const info = selectedCluster?.status?.resource_info;
    const cache = endpointZCacheOptions(selectedCluster);
    if (!cacheEnabled || !cache?.enabled || !info) return info;
    const names = new Set(cache.target_nodes ?? []);
    const nodes = Object.fromEntries(
      Object.entries(info.node_resources ?? {}).filter(([name]) =>
        names.has(name),
      ),
    );
    return {
      ...info,
      node_resources: nodes,
      allocatable: cachePoolResources(nodes, "allocatable"),
      available: cachePoolResources(nodes, "available"),
    };
  }, [selectedCluster, cacheEnabled]);

  const { summary: clusterResources, acceleratorOptions } = useMemo(() => {
    return parseClusterResources(schedulingResourceInfo, (type) =>
      t(`clusters.acceleratorTypes.${type}`, { defaultValue: type }),
    );
  }, [schedulingResourceInfo, t]);

  const singleNodeMax = useMemo(() => {
    if (!schedulingResourceInfo) {
      return null;
    }
    return findBestNodeForAccelerator(
      schedulingResourceInfo.node_resources,
      selectedAccelerator?.type || undefined,
      selectedAccelerator?.product || undefined,
    );
  }, [selectedAccelerator, schedulingResourceInfo]);

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

  const gpuStep = gpuCountStep(selectedCluster);

  return {
    selectedCluster,
    schedulingResourceInfo,
    clusterResources,
    acceleratorOptions,
    selectedAcceleratorOption,
    maxAvailable,
    gpuStep,
  };
}
