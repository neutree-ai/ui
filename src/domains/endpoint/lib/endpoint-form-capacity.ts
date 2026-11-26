import type { parseClusterResources } from "@/domains/endpoint/lib/cluster-resources";
import {
  type computeMaxAvailable,
  isRequestWithinAllocation,
  isResourceRequestExceeded,
} from "@/domains/endpoint/lib/endpoint-form-helpers";
import type { EndpointReviewCapacityMetric } from "@/domains/endpoint/lib/review-context";
import {
  formatVgpuMemoryGiBInputValue,
  getEffectiveVgpuMemoryMiB,
  getRoundedVgpuMemoryGiBValue,
  isVgpuVirtualizationResourceSupported,
  VGPU_VIRTUALIZATION_CORE_PERCENT_RESOURCE_KEY,
  VGPU_VIRTUALIZATION_MEMORY_MIB_RESOURCE_KEY,
} from "@/domains/endpoint/lib/vgpu";
import type {
  Endpoint,
  EndpointClusterRef,
  ResourceSpec,
} from "@/domains/endpoint/types";
import {
  addBackEndpointDeviceAllocationsToNodeResources,
  calculateGpuPlacementCapacity,
  calculatePhysicalCardUsageForRequest,
  calculateVgpuCardCapacity,
  calculateVgpuMemoryBoundaryMiB,
  calculateVgpuPhysicalCardUsage,
  sumMatchingDeviceAvailableResources,
} from "@/foundation/accelerator/gpu-device-resources";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";

export type GpuAllocationMode = "full" | "vgpu";

type Accelerator = ResourceSpec["accelerator"] | undefined;
type ParsedClusterResources = ReturnType<typeof parseClusterResources>;
type AcceleratorOption = ParsedClusterResources["acceleratorOptions"][number];
type MaxAvailable = ReturnType<typeof computeMaxAvailable>;

/** Whether the request names both an accelerator type and a product. */
const hasAcceleratorChoice = (accelerator: Accelerator) =>
  Boolean(accelerator?.type && accelerator?.product);

/** The accelerator picker value ("type:product"), empty while none is chosen. */
export const acceleratorChoiceValue = (accelerator: Accelerator) =>
  accelerator?.type && accelerator?.product
    ? `${accelerator.type}:${accelerator.product}`
    : "";

/** What the selected cluster offers the request form. */
export function endpointFormCluster(cluster: EndpointClusterRef | undefined) {
  const type = cluster?.spec?.type;
  const supported =
    cluster?.status?.accelerator_virtualization?.supported_resources;
  const nodeResources = cluster?.status?.resource_info?.node_resources;
  return {
    clusterType: (type === "ssh" || type === "kubernetes" ? type : undefined) as
      | "ssh"
      | "kubernetes"
      | undefined,
    vgpuEnabled:
      cluster?.spec.type === "kubernetes" &&
      cluster.spec.accelerator_virtualization?.enabled === true,
    // Inputs for virtualization resources outside the cluster's
    // supported_resources are disabled, so the form cannot build a spec the
    // backend rejects; the mode name is not consulted.
    memorySupported: isVgpuVirtualizationResourceSupported(
      supported,
      VGPU_VIRTUALIZATION_MEMORY_MIB_RESOURCE_KEY,
    ),
    coreSupported: isVgpuVirtualizationResourceSupported(
      supported,
      VGPU_VIRTUALIZATION_CORE_PERCENT_RESOURCE_KEY,
    ),
    nodeCount: nodeResources
      ? Object.keys(nodeResources).length
      : (cluster?.status?.ready_nodes ?? null),
    hasNodeSnapshot: Boolean(
      nodeResources && Object.keys(nodeResources).length > 0,
    ),
    hasCapacityEvidence: Boolean(cluster?.status?.resource_info),
  };
}

type EndpointFormCluster = ReturnType<typeof endpointFormCluster>;

/**
 * While editing, what the endpoint already holds that the request may reuse,
 * and whether the request asks for nothing beyond it.
 */
export function endpointEditCredit({
  editing,
  endpoint,
  currentCluster,
  cacheChanged,
  savedResources,
  resources,
  replicaCount,
}: {
  editing: boolean;
  endpoint: Endpoint | undefined;
  currentCluster: string;
  cacheChanged: boolean;
  savedResources: ResourceSpec | null;
  resources: ResourceSpec | null;
  replicaCount: number;
}) {
  const runtime = endpoint?.status?.resources;
  const reusable = Boolean(
    editing && endpoint?.spec?.cluster === currentCluster && runtime != null,
  );
  return {
    runtimeResources: reusable ? runtime : undefined,
    savedPerReplica: reusable
      ? {
          cpuPerReplica: savedResources?.cpu,
          memoryPerReplica: savedResources?.memory,
        }
      : undefined,
    // Static-node clusters report runtime placement only for replicas holding
    // GPU devices, so a running CPU-only endpoint has no node to credit its own
    // CPU/memory back to. A request within what it already holds needs no new
    // capacity, so placement is not checked for it.
    needsNoNewCapacity: Boolean(
      editing &&
        endpoint?.status?.phase === "Running" &&
        !runtime?.replicas?.length &&
        endpoint.spec?.cluster === currentCluster &&
        !cacheChanged &&
        isRequestWithinAllocation(
          {
            resources: savedResources,
            replicas: Math.max(1, Number(endpoint.spec?.replicas?.num || 1)),
          },
          { resources, replicas: replicaCount },
        ),
    ),
  };
}

type EndpointEditCredit = ReturnType<typeof endpointEditCredit>;

/**
 * The request's allocation mode, card and resource figures and capacity
 * verdicts against the cluster's nodes (or its aggregate figures while no node
 * snapshot is known).
 */
export function endpointRequestCapacity({
  resources,
  replicaCount,
  currentCluster,
  cluster,
  nodeResources,
  credit,
  option,
  maxAvailable,
  gpuStep,
  allocationChoice,
}: {
  resources: ResourceSpec | null;
  replicaCount: number;
  currentCluster: string;
  cluster: EndpointFormCluster;
  nodeResources: ClusterResourceInfo["node_resources"] | undefined;
  credit: EndpointEditCredit;
  option: AcceleratorOption | undefined;
  maxAvailable: MaxAvailable;
  gpuStep: number;
  allocationChoice: GpuAllocationMode | null;
}) {
  const selectedAccelerator = resources?.accelerator;
  const virtualization = selectedAccelerator?.virtualization;
  const gpuUsage = resources?.gpu || 0;
  const hasAccelerator = hasAcceleratorChoice(selectedAccelerator);
  const hasNodeResourceSnapshot = cluster.hasNodeSnapshot;

  const showVgpuFields = Boolean(cluster.vgpuEnabled && hasAccelerator);
  const selectedMemoryTotalMiB = option?.memoryTotalMiB;
  const effectiveVgpuMemoryMiB = getEffectiveVgpuMemoryMiB(
    virtualization,
    selectedMemoryTotalMiB,
  );
  const canUseVgpuAllocation = showVgpuFields && cluster.memorySupported;
  const inferredGpuAllocationMode: GpuAllocationMode =
    canUseVgpuAllocation && virtualization?.memory_mib ? "vgpu" : "full";
  const effectiveGpuAllocationMode: GpuAllocationMode =
    canUseVgpuAllocation && allocationChoice === "vgpu"
      ? "vgpu"
      : inferredGpuAllocationMode;
  const isVgpuAllocationMode = effectiveGpuAllocationMode === "vgpu";
  const isVgpuCapacityPending =
    isVgpuAllocationMode && effectiveVgpuMemoryMiB === null;
  const gpuInputStep = isVgpuAllocationMode || gpuUsage >= 1 ? 1 : gpuStep;
  const vgpuCoreUnitsPerCard = Number(virtualization?.core_percent || 0);

  const reusableNodeResources = addBackEndpointDeviceAllocationsToNodeResources(
    nodeResources,
    credit.runtimeResources,
    undefined,
    credit.savedPerReplica,
  );
  const matchingDeviceAvailableResources = sumMatchingDeviceAvailableResources(
    reusableNodeResources,
    selectedAccelerator,
  );
  const vgpuCardCapacity = calculateVgpuCardCapacity(reusableNodeResources, {
    selectedAccelerator,
    memoryMiBPerCard: effectiveVgpuMemoryMiB,
    coreUnitsPerCard: vgpuCoreUnitsPerCard,
  });
  const hasSelectedDeviceResources =
    matchingDeviceAvailableResources.memoryMiB > 0 ||
    matchingDeviceAvailableResources.coreUnits > 0 ||
    vgpuCardCapacity.matchingDeviceCount > 0;
  const requestedVirtualCards = gpuUsage * replicaCount;
  const requestedFullGpuCards = gpuUsage * replicaCount;
  const requestedVgpuMemoryMiB = effectiveVgpuMemoryMiB
    ? requestedVirtualCards * effectiveVgpuMemoryMiB
    : 0;
  const requestedVgpuCoreUnits = vgpuCoreUnitsPerCard
    ? requestedVirtualCards * vgpuCoreUnitsPerCard
    : 0;
  const isFractionalGpuAllocationMode =
    !isVgpuAllocationMode && gpuUsage > 0 && gpuUsage < 1;
  const nonVgpuPhysicalCardUsage = calculatePhysicalCardUsageForRequest(
    reusableNodeResources,
    {
      allocationMode: isFractionalGpuAllocationMode ? "fractional" : "full",
      selectedAccelerator,
      requestedPerReplica: gpuUsage,
      replicaCount,
    },
  );
  const placementRequest = {
    coreUnitsPerCard: vgpuCoreUnitsPerCard,
    cpuPerReplica: resources?.cpu,
    gpuPerReplica: gpuUsage,
    memoryMiBPerCard: effectiveVgpuMemoryMiB,
    memoryPerReplica: resources?.memory,
    replicaCount,
    selectedAccelerator,
  };
  const placementCapacity =
    !currentCluster ||
    !hasNodeResourceSnapshot ||
    credit.needsNoNewCapacity ||
    (gpuUsage > 0 && (!selectedAccelerator?.product || isVgpuCapacityPending))
      ? null
      : calculateGpuPlacementCapacity(reusableNodeResources ?? {}, {
          ...placementRequest,
          allocationMode: isVgpuAllocationMode
            ? "vgpu"
            : isFractionalGpuAllocationMode
              ? "fractional"
              : "full",
        });
  const vgpuPhysicalCardUsage = isVgpuAllocationMode
    ? calculateVgpuPhysicalCardUsage(reusableNodeResources, {
        ...placementRequest,
        allocationMode: "vgpu",
      })
    : null;
  const availableFullGpuCards = hasNodeResourceSnapshot
    ? nonVgpuPhysicalCardUsage.available
    : (option?.available ?? 0);
  const maxFullGpuCards = option?.total ?? maxAvailable.gpu.total;
  const hasRawAvailableVgpuMemoryMiB =
    hasSelectedDeviceResources ||
    Number.isFinite(option?.virtualizationMemoryMiB);
  const rawAvailableVgpuMemoryMiB = hasSelectedDeviceResources
    ? matchingDeviceAvailableResources.memoryMiB
    : Number(option?.virtualizationMemoryMiB || 0);
  const rawAvailableVgpuCoreUnits = hasSelectedDeviceResources
    ? matchingDeviceAvailableResources.coreUnits
    : Number(option?.virtualizationCoreUnits || 0);
  const fallbackVgpuAvailablePhysicalCards =
    option?.available ?? maxAvailable.gpu.available;
  const fallbackVgpuMaxPhysicalCards =
    option?.total ||
    maxAvailable.gpu.total ||
    vgpuCardCapacity.matchingDeviceCount;
  const availableVirtualPhysicalCards = hasSelectedDeviceResources
    ? vgpuCardCapacity.totalCards
    : fallbackVgpuAvailablePhysicalCards;
  const totalVirtualCardCapacity =
    fallbackVgpuMaxPhysicalCards > 0
      ? Math.min(availableVirtualPhysicalCards, fallbackVgpuMaxPhysicalCards)
      : availableVirtualPhysicalCards;
  // Cards are requested across replicas (gpu per replica × replica count), so
  // the displayed request and the capacity check compare totals.
  const displayedVgpuPhysicalCards =
    vgpuPhysicalCardUsage ?? requestedVirtualCards;
  const rawVgpuMemoryBoundaryMiB = (() => {
    const rawMaxMiB =
      typeof selectedMemoryTotalMiB === "number" &&
      Number.isFinite(selectedMemoryTotalMiB)
        ? selectedMemoryTotalMiB
        : null;
    if (hasSelectedDeviceResources) {
      const deviceBoundaryMiB = calculateVgpuMemoryBoundaryMiB(
        reusableNodeResources,
        {
          selectedAccelerator,
          requestedCardCount: requestedVirtualCards,
          coreUnitsPerCard: vgpuCoreUnitsPerCard,
        },
      );
      if (deviceBoundaryMiB !== null) {
        return rawMaxMiB === null
          ? deviceBoundaryMiB
          : Math.min(rawMaxMiB, deviceBoundaryMiB);
      }
    }
    if (!hasRawAvailableVgpuMemoryMiB) {
      return rawMaxMiB;
    }
    const requestedCardCount = Math.max(1, requestedVirtualCards);
    const perCardBoundaryMiB = Math.floor(
      rawAvailableVgpuMemoryMiB / requestedCardCount,
    );
    if (!Number.isFinite(perCardBoundaryMiB)) {
      return rawMaxMiB;
    }
    const boundedPerCardMiB = Math.max(0, perCardBoundaryMiB);
    return rawMaxMiB === null
      ? boundedPerCardMiB
      : Math.min(rawMaxMiB, boundedPerCardMiB);
  })();
  const vgpuMemoryGiBInputValue =
    virtualization?.memory_mib !== undefined
      ? formatVgpuMemoryGiBInputValue(
          virtualization.memory_mib,
          selectedMemoryTotalMiB,
          rawVgpuMemoryBoundaryMiB,
        )
      : effectiveVgpuMemoryMiB
        ? formatVgpuMemoryGiBInputValue(
            effectiveVgpuMemoryMiB,
            selectedMemoryTotalMiB,
            rawVgpuMemoryBoundaryMiB,
          )
        : "";

  const isLegacyVgpuCapacityExceeded = Boolean(
    !hasNodeResourceSnapshot &&
      isVgpuAllocationMode &&
      !isVgpuCapacityPending &&
      selectedAccelerator?.product &&
      (requestedVirtualCards > availableVirtualPhysicalCards ||
        (hasRawAvailableVgpuMemoryMiB &&
          requestedVgpuMemoryMiB > rawAvailableVgpuMemoryMiB) ||
        (vgpuCoreUnitsPerCard > 0 &&
          Number.isFinite(option?.virtualizationCoreUnits) &&
          requestedVgpuCoreUnits > rawAvailableVgpuCoreUnits)),
  );
  const isLegacyFullGpuCapacityExceeded = Boolean(
    !hasNodeResourceSnapshot &&
      !isVgpuAllocationMode &&
      selectedAccelerator?.product &&
      requestedFullGpuCards > availableFullGpuCards,
  );
  const hasNoEligibleNodes =
    hasNodeResourceSnapshot &&
    Object.keys(reusableNodeResources ?? {}).length === 0;
  const isPlacementCapacityExceeded =
    hasNoEligibleNodes || placementCapacity?.overall === "fail";
  const isPlacementCpuCapacityExceeded =
    placementCapacity?.cpu === "fail" ||
    (hasNoEligibleNodes && Number(resources?.cpu) > 0);
  const isPlacementMemoryCapacityExceeded =
    placementCapacity?.memory === "fail" ||
    (hasNoEligibleNodes && Number(resources?.memory) > 0);
  const isPlacementGpuCapacityExceeded =
    placementCapacity?.gpu === "fail" || (hasNoEligibleNodes && gpuUsage > 0);
  const hasKnownGpuPlacement = Boolean(
    hasNoEligibleNodes ||
      (placementCapacity && placementCapacity.gpu !== "unknown"),
  );
  const isVgpuCapacityExceeded = hasKnownGpuPlacement
    ? Boolean(
        isVgpuAllocationMode &&
          !isVgpuCapacityPending &&
          isPlacementGpuCapacityExceeded,
      )
    : isLegacyVgpuCapacityExceeded;
  const isFullGpuCapacityExceeded = hasKnownGpuPlacement
    ? Boolean(!isVgpuAllocationMode && isPlacementGpuCapacityExceeded)
    : isLegacyFullGpuCapacityExceeded;
  const hasNoMatchingAccelerator = Boolean(
    hasKnownGpuPlacement && placementCapacity?.matchingDeviceCount === 0,
  );
  const hasVgpuMemoryCapacityExceeded = Boolean(
    isVgpuAllocationMode &&
      hasKnownGpuPlacement &&
      !hasNoMatchingAccelerator &&
      requestedVgpuMemoryMiB > 0 &&
      placementCapacity &&
      placementCapacity.totalAvailableMemoryMiB < requestedVgpuMemoryMiB,
  );
  const hasVgpuCoreCapacityExceeded = Boolean(
    isVgpuAllocationMode &&
      hasKnownGpuPlacement &&
      !hasNoMatchingAccelerator &&
      requestedVgpuCoreUnits > 0 &&
      placementCapacity &&
      placementCapacity.totalAvailableCoreUnits < requestedVgpuCoreUnits,
  );
  const hasFullGpuAggregateCardCapacityExceeded = Boolean(
    !isVgpuAllocationMode &&
      !isFractionalGpuAllocationMode &&
      hasKnownGpuPlacement &&
      !hasNoMatchingAccelerator &&
      placementCapacity &&
      placementCapacity.satisfyingDeviceCount < requestedFullGpuCards,
  );
  const hasNoNodeForFractionalGpuReplica = Boolean(
    isFractionalGpuAllocationMode &&
      isPlacementGpuCapacityExceeded &&
      !hasNoMatchingAccelerator &&
      placementCapacity?.maxGpuPlaceableReplicas === 0,
  );
  const hasNoNodeForFullGpuReplica = Boolean(
    !isVgpuAllocationMode &&
      !isFractionalGpuAllocationMode &&
      placementCapacity?.gpu === "fail" &&
      placementCapacity.requestedCardsPerReplica > 1 &&
      !hasFullGpuAggregateCardCapacityExceeded &&
      placementCapacity.maxGpuPlaceableReplicas === 0 &&
      placementCapacity.maxFullGpuCardsPerNode <
        placementCapacity.requestedCardsPerReplica,
  );
  const hasNoNodeForVgpuReplica = Boolean(
    isVgpuAllocationMode &&
      isPlacementGpuCapacityExceeded &&
      !hasNoMatchingAccelerator &&
      !hasVgpuMemoryCapacityExceeded &&
      !hasVgpuCoreCapacityExceeded &&
      placementCapacity?.maxGpuPlaceableReplicas === 0,
  );
  const hasPartialGpuReplicaPlacement = Boolean(
    isPlacementGpuCapacityExceeded &&
      !hasNoMatchingAccelerator &&
      !hasFullGpuAggregateCardCapacityExceeded &&
      !hasVgpuMemoryCapacityExceeded &&
      !hasVgpuCoreCapacityExceeded &&
      placementCapacity?.maxGpuPlaceableReplicas != null &&
      placementCapacity.maxGpuPlaceableReplicas > 0 &&
      placementCapacity.maxGpuPlaceableReplicas < replicaCount,
  );
  const hasNodeCpuPlacementCapacityExceeded = Boolean(
    placementCapacity?.gpu === "pass" &&
      placementCapacity.cpu === "pass" &&
      placementCapacity.cpuPlacement === "fail",
  );
  const hasNodeMemoryPlacementCapacityExceeded = Boolean(
    placementCapacity?.gpu === "pass" &&
      placementCapacity.memory === "pass" &&
      placementCapacity.memoryPlacement === "fail",
  );
  const hasCombinedNodePlacementCapacityExceeded = Boolean(
    placementCapacity?.overall === "fail" &&
      placementCapacity.gpu === "pass" &&
      placementCapacity.cpu === "pass" &&
      placementCapacity.memory === "pass" &&
      placementCapacity.cpuPlacement === "pass" &&
      placementCapacity.memoryPlacement === "pass",
  );
  // With a node snapshot, placementCapacity sums CPU/memory across nodes while
  // keeping each replica on a GPU node. maxAvailable is a single-node input
  // limit, so the aggregate check against it applies only without a snapshot.
  const cpuPerReplica = resources?.cpu ?? 0;
  const memoryPerReplica = resources?.memory ?? 0;
  const requestedCpuTotal = (resources?.cpu || 0) * replicaCount;
  const requestedMemoryTotal = (resources?.memory || 0) * replicaCount;
  const isCpuCapacityExceeded =
    Boolean(
      currentCluster &&
        !hasCombinedNodePlacementCapacityExceeded &&
        !hasNodeResourceSnapshot &&
        isResourceRequestExceeded(
          requestedCpuTotal,
          maxAvailable.cpu.available,
          maxAvailable.cpu.total,
        ),
    ) ||
    Boolean(isPlacementCpuCapacityExceeded) ||
    hasNodeCpuPlacementCapacityExceeded;
  const isMemoryCapacityExceeded =
    Boolean(
      currentCluster &&
        !hasCombinedNodePlacementCapacityExceeded &&
        !hasNodeResourceSnapshot &&
        isResourceRequestExceeded(
          requestedMemoryTotal,
          maxAvailable.memory.available,
          maxAvailable.memory.total,
        ),
    ) ||
    Boolean(isPlacementMemoryCapacityExceeded) ||
    hasNodeMemoryPlacementCapacityExceeded;

  return {
    gpuUsage,
    hasAccelerator,
    showVgpuFields,
    selectedMemoryTotalMiB,
    effectiveVgpuMemoryMiB,
    canUseVgpuAllocation,
    effectiveGpuAllocationMode,
    isVgpuAllocationMode,
    isVgpuCapacityPending,
    isFractionalGpuAllocationMode,
    gpuInputStep,
    vgpuCoreUnitsPerCard,
    reusableNodeResources,
    placementCapacity,
    requestedFullGpuCards,
    availableFullGpuCards,
    maxFullGpuCards,
    requestedVirtualCards,
    totalVirtualCardCapacity,
    displayedVgpuPhysicalCards,
    requestedVgpuMemoryMiB,
    rawAvailableVgpuMemoryMiB,
    requestedVgpuCoreUnits,
    rawAvailableVgpuCoreUnits,
    rawVgpuMemoryBoundaryMiB,
    vgpuMemoryGiBMaxValue: getRoundedVgpuMemoryGiBValue(
      rawVgpuMemoryBoundaryMiB,
    ),
    vgpuMemoryGiBInputValue,
    currentRequestAvailableCoreUnits: isVgpuAllocationMode
      ? rawAvailableVgpuCoreUnits
      : 0,
    currentRequestCoreUnitsPerCard: isVgpuAllocationMode
      ? vgpuCoreUnitsPerCard
      : 0,
    currentRequestCoreUnits: isVgpuAllocationMode ? requestedVgpuCoreUnits : 0,
    cpuInput: {
      value: cpuPerReplica,
      max: Math.max(
        cpuPerReplica,
        placementCapacity?.maxCpuPerReplica ?? maxAvailable.cpu.available,
      ),
    },
    memoryInput: {
      value: memoryPerReplica,
      max: Math.max(
        memoryPerReplica,
        placementCapacity?.maxMemoryPerReplica ?? maxAvailable.memory.available,
      ),
    },
    isFullGpuCapacityExceeded,
    isVgpuCapacityExceeded,
    isCpuCapacityExceeded,
    isMemoryCapacityExceeded,
    hasNodeCpuPlacementCapacityExceeded,
    hasNodeMemoryPlacementCapacityExceeded,
    hasNoMatchingAccelerator,
    hasVgpuMemoryCapacityExceeded,
    hasVgpuCoreCapacityExceeded,
    hasFullGpuAggregateCardCapacityExceeded,
    hasNoNodeForFractionalGpuReplica,
    hasNoNodeForFullGpuReplica,
    hasNoNodeForVgpuReplica,
    hasPartialGpuReplicaPlacement,
    hasCombinedNodePlacementCapacityExceeded,
    exceeded:
      cluster.hasCapacityEvidence &&
      (isCpuCapacityExceeded ||
        isMemoryCapacityExceeded ||
        isFullGpuCapacityExceeded ||
        isVgpuCapacityExceeded ||
        isPlacementCapacityExceeded),
    panelRequest: {
      allocationMode: isFractionalGpuAllocationMode
        ? ("fractional" as const)
        : effectiveGpuAllocationMode,
      gpuPerReplica: gpuUsage,
      cpuPerReplica: resources?.cpu,
      memoryPerReplica: resources?.memory,
      requestedFullGpuCards,
      fullGpuCardCapacity: availableFullGpuCards,
      fullGpuCapacityExceeded: isFullGpuCapacityExceeded,
      requestedVirtualCards,
      totalVirtualCardCapacity,
      requestedVgpuMemoryMiB,
      availableVgpuMemoryMiB: rawAvailableVgpuMemoryMiB,
      requestedVgpuCoreUnits,
      availableVgpuCoreUnits: rawAvailableVgpuCoreUnits,
      memoryMiBPerCard: effectiveVgpuMemoryMiB,
      coreUnitsPerCard: vgpuCoreUnitsPerCard,
      vgpuCapacityExceeded: isVgpuCapacityExceeded,
    },
  };
}

export type EndpointRequestCapacity = ReturnType<
  typeof endpointRequestCapacity
>;

/** A capacity message as a translation key and its parameters. */
type CapacityMessage = [key: string, params?: Record<string, unknown>];

/**
 * Why the accelerator request cannot be placed, most specific first; empty
 * without a cluster, capacity evidence or a chosen accelerator.
 */
export function gpuCapacityMessages(
  c: EndpointRequestCapacity,
  {
    currentCluster,
    cluster,
    accelerator,
    replicaCount,
  }: {
    currentCluster: string;
    cluster: EndpointFormCluster;
    accelerator: Accelerator;
    replicaCount: number;
  },
): CapacityMessage[] {
  const messages: CapacityMessage[] = [];
  if (!currentCluster || !cluster.hasCapacityEvidence || !c.hasAccelerator)
    return messages;
  const placement = c.placementCapacity;
  const noMatching: CapacityMessage = [
    "endpoints.messages.noMatchingAccelerator",
    { product: accelerator?.product },
  ];
  const partial: CapacityMessage = [
    "endpoints.messages.partialGpuReplicaPlacement",
    {
      available: placement?.maxGpuPlaceableReplicas ?? 0,
      requested: replicaCount,
    },
  ];
  if (c.isVgpuAllocationMode && c.isVgpuCapacityExceeded) {
    if (c.hasNoMatchingAccelerator) messages.push(noMatching);
    else if (!c.hasNoNodeForVgpuReplica)
      messages.push(["endpoints.messages.vgpuResourcesInsufficient"]);
    if (c.hasVgpuMemoryCapacityExceeded)
      messages.push(["endpoints.messages.vgpuMemoryResourcesInsufficient"]);
    if (c.hasVgpuCoreCapacityExceeded)
      messages.push(["endpoints.messages.vgpuCoreResourcesInsufficient"]);
    if (c.hasNoNodeForVgpuReplica)
      messages.push(["endpoints.messages.noNodeCanScheduleVgpuRequest"]);
    if (c.hasPartialGpuReplicaPlacement) messages.push(partial);
  } else if (!c.isVgpuAllocationMode && c.isFullGpuCapacityExceeded) {
    if (c.hasNoMatchingAccelerator) messages.push(noMatching);
    else if (c.hasNoNodeForFullGpuReplica)
      messages.push([
        "endpoints.messages.noNodeCanScheduleFullGpuRequest",
        { count: placement?.requestedCardsPerReplica },
      ]);
    else if (c.hasNoNodeForFractionalGpuReplica)
      messages.push([
        "endpoints.messages.noNodeCanScheduleFractionalGpuRequest",
      ]);
    else if (!c.hasFullGpuAggregateCardCapacityExceeded)
      messages.push([
        c.isFractionalGpuAllocationMode
          ? "endpoints.messages.fractionalGpuResourcesInsufficient"
          : "endpoints.messages.fullGpuResourcesInsufficient",
      ]);
    if (c.hasFullGpuAggregateCardCapacityExceeded)
      messages.push([
        "endpoints.messages.fullGpuCardCapacityInsufficient",
        {
          available: placement?.satisfyingDeviceCount ?? 0,
          requested: c.requestedFullGpuCards,
        },
      ]);
    if (c.hasPartialGpuReplicaPlacement) messages.push(partial);
  }
  if (c.hasCombinedNodePlacementCapacityExceeded)
    messages.push([
      "endpoints.messages.noNodeCanScheduleCombinedResourceRequest",
    ]);
  return messages;
}

const positiveOrNull = (value: number, scale = 1) =>
  Number.isFinite(value) && value > 0 ? value / scale : null;

/** The cluster capacity figures the review step shows, or null without capacity evidence. */
export function reviewCapacityMetrics(
  c: EndpointRequestCapacity,
  {
    resources,
    replicaCount,
    cluster,
    resourceInfo,
    clusterResources,
    maxAvailable,
  }: {
    resources: ResourceSpec | null;
    replicaCount: number;
    cluster: EndpointFormCluster;
    resourceInfo: ClusterResourceInfo | null | undefined;
    clusterResources: ParsedClusterResources["summary"];
    maxAvailable: MaxAvailable;
  },
): EndpointReviewCapacityMetric[] | null {
  if (!cluster.hasCapacityEvidence) return null;
  const accelerator = resources?.accelerator;
  const product =
    accelerator?.type && accelerator.product
      ? resourceInfo?.allocatable?.accelerator_groups?.[accelerator.type]
          ?.products?.[accelerator.product]
      : undefined;
  const placement = c.placementCapacity;
  return [
    {
      key: "cpu",
      requested: (resources?.cpu || 0) * replicaCount,
      available: placement?.totalAvailableCpu ?? maxAvailable.cpu.available,
      total: clusterResources?.cpu.total ?? maxAvailable.cpu.total,
    },
    {
      key: "memory",
      requested: (resources?.memory || 0) * replicaCount,
      available:
        placement?.totalAvailableMemory ?? maxAvailable.memory.available,
      total: clusterResources?.memory.total ?? maxAvailable.memory.total,
    },
    ...(c.hasAccelerator
      ? [
          {
            key: "cards" as const,
            requested: c.isVgpuAllocationMode
              ? c.displayedVgpuPhysicalCards
              : c.requestedFullGpuCards,
            available: c.isVgpuAllocationMode
              ? c.totalVirtualCardCapacity
              : c.availableFullGpuCards,
            total: c.maxFullGpuCards,
          },
        ]
      : []),
    ...(c.isVgpuAllocationMode
      ? [
          {
            key: "vram" as const,
            requested: c.requestedVgpuMemoryMiB / 1024,
            available: c.rawAvailableVgpuMemoryMiB / 1024,
            total: positiveOrNull(
              Number(product?.virtualization?.memory_mib),
              1024,
            ),
          },
          {
            key: "core" as const,
            requested: c.requestedVgpuCoreUnits,
            available: c.rawAvailableVgpuCoreUnits,
            total: positiveOrNull(Number(product?.virtualization?.core_units)),
          },
        ]
      : []),
  ];
}
