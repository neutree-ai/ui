import { useMemo } from "react";
import {
  findBestNodeForAccelerator,
  parseClusterResources,
} from "@/domains/endpoint/lib/cluster-resources";
import { computeMaxAvailable } from "@/domains/endpoint/lib/endpoint-form-helpers";
import type { EndpointClusterRef } from "@/domains/endpoint/types";

interface UseEndpointClusterResourcesProps {
  currentCluster: string;
  clustersData: EndpointClusterRef[] | undefined;
  selectedAccelerator: { type: string; product: string } | null | undefined;
  currentUsage: { cpu: number; memory: number; gpu: number };
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function useEndpointClusterResources({
  currentCluster,
  clustersData,
  selectedAccelerator,
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
