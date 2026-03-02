import {
  findBestNodeForAccelerator,
  parseClusterResources,
} from "@/domains/endpoint/lib/cluster-resources";
import { computeMaxAvailable } from "@/domains/endpoint/lib/endpoint-form-helpers";
import type { EndpointClusterRef } from "@/domains/endpoint/types";
import { useMemo } from "react";

interface UseEndpointClusterResourcesProps {
  currentCluster: string;
  clustersData: EndpointClusterRef[] | undefined;
  selectedAccelerator: { type: string; product: string } | null | undefined;
  cpuUsage: number;
  memoryUsage: number;
  currentUsage: { cpu: number; memory: number; gpu: number };
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function useEndpointClusterResources({
  currentCluster,
  clustersData,
  selectedAccelerator,
  cpuUsage,
  memoryUsage,
  currentUsage,
  t,
}: UseEndpointClusterResourcesProps) {
  const selectedCluster = useMemo(() => {
    if (!currentCluster || !clustersData) {
      return undefined;
    }
    return clustersData.find(
      (opt) => opt.metadata.name === currentCluster,
    ) as unknown as EndpointClusterRef | undefined;
  }, [currentCluster, clustersData]);

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

  const maxAvailable = useMemo(
    () => computeMaxAvailable(singleNodeMax, clusterResources, currentUsage),
    [singleNodeMax, clusterResources, currentUsage],
  );

  const dynamicAvailability = useMemo(() => {
    const currentCpu = cpuUsage || 0;
    const currentMemory = memoryUsage || 0;
    return {
      cpu: maxAvailable.cpu.available - currentCpu,
      memory: maxAvailable.memory.available - currentMemory,
    };
  }, [maxAvailable, cpuUsage, memoryUsage]);

  const gpuStep = useMemo(() => {
    const clusterType = selectedCluster?.spec?.type;
    return clusterType === "ssh" ? 0.1 : 1;
  }, [selectedCluster?.spec?.type]);

  return {
    selectedCluster,
    clusterResources,
    acceleratorOptions,
    maxAvailable,
    dynamicAvailability,
    gpuStep,
  };
}
