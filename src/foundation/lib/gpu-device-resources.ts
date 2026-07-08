import { matchesAcceleratorName } from "@/foundation/recipe/vram";
import type {
  ClusterResourceInfo,
  DeviceResource,
  NodeResourceStatus,
  ResourceInfo,
} from "@/foundation/types/resource-types";

type SelectedAccelerator = {
  type?: string | null;
  product?: string | null;
};

export type DevicePoolUsage = {
  available: number | null;
  total: number | null;
  used: number | null;
  percent: number;
};

export type GpuDeviceResourceRow = {
  acceleratorType: string | null;
  nodeName: string;
  uuid: string;
  shortUuid: string;
  gpuNumber: number;
  product: string;
  healthy: boolean;
  fullFree: boolean;
  matchesSelectedAccelerator: boolean;
  memory: DevicePoolUsage;
  core: DevicePoolUsage;
};

type GpuCardResourceRow = {
  acceleratorType: string;
  product: string;
  matchesSelectedAccelerator: boolean;
  memoryTotalMiB?: number | null;
  quantity: DevicePoolUsage;
  memory: DevicePoolUsage;
  core: DevicePoolUsage;
};

type NodePhysicalGpuResourceRow = {
  nodeName: string;
  quantity: DevicePoolUsage;
  cpu: DevicePoolUsage;
  memory: DevicePoolUsage;
};

type VgpuCardCapacity = {
  matchingDeviceCount: number;
  maxCardsPerReplica: number;
  totalCards: number;
};

export type GpuAllocationMode = "full" | "fractional" | "vgpu";

type GpuRequestCapacity = {
  allocationMode: GpuAllocationMode;
  canAllocate: boolean;
  canAllocateCpu: boolean;
  canAllocateMemory: boolean;
  matchingDeviceCount: number;
  maxCardsPerReplica: number;
  requestedCardsPerReplica: number;
  requestedCpu: number;
  requestedMemory: number;
  requestedTotalCards: number;
  satisfyingDeviceCount: number;
  totalAvailableCpu: number;
  totalAvailableMemory: number;
  totalAvailableCoreUnits: number;
  totalAvailableMemoryMiB: number;
};

type GpuDeviceResourceFilters = {
  nodeName?: string | null;
  product?: string | null;
  search?: string | null;
};

export const GPU_DEVICE_FILTER_ALL = "__all__";

type AcceleratorGroups = NonNullable<ResourceInfo["accelerator_groups"]>;
type AcceleratorGroupResource = AcceleratorGroups[string];

const buildPoolUsage = (
  total: number | null | undefined,
  available: number | null | undefined,
): DevicePoolUsage => {
  const normalizedTotal =
    typeof total === "number" && Number.isFinite(total) ? total : null;
  const finiteAvailable =
    typeof available === "number" && Number.isFinite(available)
      ? available
      : null;
  const normalizedAvailable =
    finiteAvailable == null
      ? null
      : normalizedTotal == null
        ? finiteAvailable
        : Math.min(Math.max(finiteAvailable, 0), normalizedTotal);
  const used =
    normalizedTotal == null || normalizedAvailable == null
      ? null
      : Math.max(normalizedTotal - normalizedAvailable, 0);
  const percent =
    normalizedTotal && normalizedTotal > 0 && used != null
      ? Math.min(Math.max(Math.round((used / normalizedTotal) * 100), 0), 100)
      : 0;

  return {
    available: normalizedAvailable,
    total: normalizedTotal,
    used,
    percent,
  };
};

const mergePoolTotals = (
  current: { total: number | null; available: number | null },
  nextTotal: number | null | undefined,
  nextAvailable: number | null | undefined,
) => ({
  total:
    current.total == null && nextTotal == null
      ? null
      : (current.total ?? 0) + (nextTotal ?? 0),
  available:
    current.available == null && nextAvailable == null
      ? null
      : (current.available ?? 0) + (nextAvailable ?? 0),
});

const sumDevicePoolsByProduct = (
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
) => {
  const result = new Map<
    string,
    {
      memory: { total: number | null; available: number | null };
      core: { total: number | null; available: number | null };
    }
  >();

  if (!nodeResources) {
    return result;
  }

  for (const nodeStatus of Object.values(nodeResources)) {
    for (const device of nodeStatus.devices ?? []) {
      if (!device.health) {
        continue;
      }

      const current = result.get(device.product) ?? {
        memory: { total: null, available: null },
        core: { total: null, available: null },
      };

      result.set(device.product, {
        memory: mergePoolTotals(
          current.memory,
          device.allocatable?.memory_mib,
          device.available?.memory_mib,
        ),
        core: mergePoolTotals(
          current.core,
          device.allocatable?.core_units,
          device.available?.core_units,
        ),
      });
    }
  }

  return result;
};

const hasFullCardAvailabilitySignals = (device: DeviceResource) =>
  typeof device.allocatable?.memory_mib === "number" &&
  typeof device.available?.memory_mib === "number" &&
  typeof device.allocatable?.core_units === "number" &&
  typeof device.available?.core_units === "number";

const isDeviceAvailableForFullCardAllocation = (device: DeviceResource) =>
  Boolean(
    device.health &&
      hasFullCardAvailabilitySignals(device) &&
      Number(device.available?.memory_mib) >=
        Number(device.allocatable?.memory_mib) &&
      Number(device.available?.core_units) >=
        Number(device.allocatable?.core_units),
  );

export function countFullCardAvailableDevicesByProduct(
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
) {
  const result = new Map<string, number>();

  if (!nodeResources) {
    return result;
  }

  for (const nodeStatus of Object.values(nodeResources)) {
    for (const device of nodeStatus.devices ?? []) {
      const current = result.get(device.product) ?? 0;
      if (!hasFullCardAvailabilitySignals(device)) {
        result.set(device.product, current);
        continue;
      }

      result.set(
        device.product,
        current + (isDeviceAvailableForFullCardAllocation(device) ? 1 : 0),
      );
    }
  }

  return result;
}

export function hasDetailedGpuDeviceResources(
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  selectedAccelerator?: SelectedAccelerator | null,
) {
  if (!nodeResources || !selectedAccelerator?.product) {
    return false;
  }

  for (const nodeStatus of Object.values(nodeResources)) {
    for (const device of nodeStatus.devices ?? []) {
      const acceleratorType = getProductAcceleratorType(
        nodeStatus.allocatable,
        device.product,
      );
      if (
        matchesSelectedAccelerator(
          { acceleratorType, product: device.product },
          selectedAccelerator,
        ) &&
        typeof device.allocatable?.memory_mib === "number" &&
        typeof device.available?.memory_mib === "number" &&
        typeof device.allocatable?.core_units === "number" &&
        typeof device.available?.core_units === "number"
      ) {
        return true;
      }
    }
  }

  return false;
}

export function getMaxAvailableGpuDeviceMemoryMiB(
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  selectedAccelerator?: SelectedAccelerator | null,
) {
  let maxMemoryMiB: number | null = null;

  for (const nodeStatus of Object.values(nodeResources ?? {})) {
    for (const device of nodeStatus.devices ?? []) {
      if (!device.health) {
        continue;
      }

      const acceleratorType = getProductAcceleratorType(
        nodeStatus.allocatable,
        device.product,
      );
      if (
        !matchesSelectedAccelerator(
          { acceleratorType, product: device.product },
          selectedAccelerator,
        )
      ) {
        continue;
      }

      const availableMemoryMiB = Number(device.available?.memory_mib);
      if (!Number.isFinite(availableMemoryMiB) || availableMemoryMiB < 0) {
        continue;
      }

      maxMemoryMiB =
        maxMemoryMiB === null
          ? availableMemoryMiB
          : Math.max(maxMemoryMiB, availableMemoryMiB);
    }
  }

  return maxMemoryMiB;
}

function countVirtualizedCardAvailabilityByProduct(
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
) {
  const result = new Map<string, { available: number; total: number }>();

  if (!nodeResources) {
    return result;
  }

  for (const nodeStatus of Object.values(nodeResources)) {
    for (const device of nodeStatus.devices ?? []) {
      const current = result.get(device.product) ?? { available: 0, total: 0 };
      const availableMemoryMiB = Number(device.available?.memory_mib || 0);
      const availableCoreUnits = Number(device.available?.core_units || 0);
      const isUnavailable =
        !device.health || availableMemoryMiB <= 0 || availableCoreUnits <= 0;

      result.set(device.product, {
        total: current.total + 1,
        available: current.available + (isUnavailable ? 0 : 1),
      });
    }
  }

  return result;
}

const shortenUuid = (uuid: string) => {
  if (uuid.length <= 18) {
    return uuid;
  }

  return `${uuid.slice(0, 8)}...${uuid.slice(-6)}`;
};

const getDeviceOrder = (order: number | null | undefined) =>
  typeof order === "number" && Number.isFinite(order) ? order : null;

const compareDevicesByOrderThenUuid = (
  first: Pick<DeviceResource, "order" | "uuid">,
  second: Pick<DeviceResource, "order" | "uuid">,
) => {
  const firstOrder = getDeviceOrder(first.order);
  const secondOrder = getDeviceOrder(second.order);

  if (firstOrder != null && secondOrder != null) {
    return firstOrder - secondOrder || first.uuid.localeCompare(second.uuid);
  }

  if (firstOrder != null) {
    return -1;
  }

  if (secondOrder != null) {
    return 1;
  }

  return first.uuid.localeCompare(second.uuid);
};

const getProductAcceleratorType = (
  resourceInfo: ResourceInfo | null | undefined,
  product: string,
): string | null => {
  if (!resourceInfo?.accelerator_groups) {
    return null;
  }

  for (const [type, group] of Object.entries(resourceInfo.accelerator_groups)) {
    if (group.products?.[product] || group.product_groups?.[product] != null) {
      return type;
    }
  }

  return null;
};

const getAcceleratorGroupQuantity = (
  group: AcceleratorGroupResource | undefined,
  product?: string | null,
) => {
  if (!group) return 0;
  if (!product) return Number(group.quantity ?? 0);

  return Number(
    group.products?.[product]?.quantity ?? group.product_groups?.[product] ?? 0,
  );
};

// Cluster-reported products are vendor-prefixed ("NVIDIA-L4") while a
// recipe/catalog-preset accelerator uses bare model names ("L4"), so exact
// string equality never holds across the two schemes. Token-match in both
// directions to line them up (NEU-501).
const productNamesMatch = (rowProduct: string, selectedProduct: string) =>
  rowProduct === selectedProduct ||
  matchesAcceleratorName(rowProduct, [selectedProduct]) ||
  matchesAcceleratorName(selectedProduct, [rowProduct]);

const matchesSelectedAccelerator = (
  row: Pick<GpuDeviceResourceRow, "acceleratorType" | "product">,
  selectedAccelerator?: SelectedAccelerator | null,
) => {
  if (!selectedAccelerator?.product && !selectedAccelerator?.type) {
    return true;
  }

  const productMatches =
    !selectedAccelerator.product ||
    productNamesMatch(row.product, selectedAccelerator.product);
  const typeMatches =
    !selectedAccelerator.type ||
    row.acceleratorType == null ||
    row.acceleratorType === selectedAccelerator.type;

  return productMatches && typeMatches;
};

export function buildNodePhysicalGpuResourceRows(
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  selectedAccelerator?: SelectedAccelerator | null,
): NodePhysicalGpuResourceRow[] {
  return Object.entries(nodeResources ?? {})
    .map(([nodeName, nodeStatus]) => {
      const allocatableGroups =
        nodeStatus.allocatable?.accelerator_groups ?? {};
      const availableGroups = nodeStatus.available?.accelerator_groups ?? {};
      const selectedType = selectedAccelerator?.type || undefined;
      const selectedProduct = selectedAccelerator?.product || undefined;
      const acceleratorTypes = selectedType
        ? [selectedType]
        : Array.from(
            new Set([
              ...Object.keys(allocatableGroups),
              ...Object.keys(availableGroups),
            ]),
          );
      const quantity = acceleratorTypes.reduce(
        (acc, acceleratorType) => ({
          total:
            acc.total +
            getAcceleratorGroupQuantity(
              allocatableGroups[acceleratorType],
              selectedProduct,
            ),
          available:
            acc.available +
            getAcceleratorGroupQuantity(
              availableGroups[acceleratorType],
              selectedProduct,
            ),
        }),
        { total: 0, available: 0 },
      );

      return {
        cpu: buildPoolUsage(
          nodeStatus.allocatable?.cpu,
          nodeStatus.available?.cpu,
        ),
        memory: buildPoolUsage(
          nodeStatus.allocatable?.memory,
          nodeStatus.available?.memory,
        ),
        nodeName,
        quantity: buildPoolUsage(quantity.total, quantity.available),
      };
    })
    .sort((first, second) => first.nodeName.localeCompare(second.nodeName));
}

export function buildGpuCardResourceRows(
  resourceInfo: ClusterResourceInfo | null | undefined,
  selectedAccelerator?: SelectedAccelerator | null,
  options?: { virtualizationEnabled?: boolean },
): GpuCardResourceRow[] {
  const allocatableGroups = resourceInfo?.allocatable?.accelerator_groups;
  if (!allocatableGroups) {
    return [];
  }

  const devicePoolsByProduct = sumDevicePoolsByProduct(
    resourceInfo?.node_resources,
  );
  const fullCardAvailableDevicesByProduct =
    countFullCardAvailableDevicesByProduct(resourceInfo?.node_resources);
  const virtualizedCardAvailabilityByProduct =
    countVirtualizedCardAvailabilityByProduct(resourceInfo?.node_resources);
  const getAvailableQuantity = (
    product: string,
    backendAvailableQuantity: number | null | undefined,
  ) => {
    if (options?.virtualizationEnabled === true) {
      return (
        virtualizedCardAvailabilityByProduct.get(product)?.available ??
        backendAvailableQuantity ??
        0
      );
    }

    if (options?.virtualizationEnabled === false) {
      return backendAvailableQuantity ?? 0;
    }

    return (
      fullCardAvailableDevicesByProduct.get(product) ??
      backendAvailableQuantity ??
      0
    );
  };

  return Object.entries(allocatableGroups).flatMap(
    ([acceleratorType, allocatableGroup]) => {
      const availableGroup =
        resourceInfo?.available?.accelerator_groups?.[acceleratorType];
      const metadataProducts =
        resourceInfo?.accelerator_metadata?.[acceleratorType]?.products ?? {};

      const allocatableProducts = allocatableGroup.products;
      const products =
        allocatableProducts && Object.keys(allocatableProducts).length > 0
          ? Object.entries(allocatableProducts).map(([product, resources]) => ({
              product,
              quantity: resources.quantity ?? 0,
              availableQuantity: getAvailableQuantity(
                product,
                availableGroup?.products?.[product]?.quantity,
              ),
              allocatableMemoryMiB: resources.virtualization?.memory_mib,
              availableMemoryMiB:
                availableGroup?.products?.[product]?.virtualization?.memory_mib,
              allocatableCoreUnits: resources.virtualization?.core_units,
              availableCoreUnits:
                availableGroup?.products?.[product]?.virtualization?.core_units,
            }))
          : Object.keys(allocatableGroup.product_groups ?? {}).length > 0
            ? Object.entries(allocatableGroup.product_groups ?? {}).map(
                ([product, quantity]) => ({
                  product,
                  quantity,
                  availableQuantity: getAvailableQuantity(
                    product,
                    availableGroup?.product_groups?.[product],
                  ),
                  allocatableMemoryMiB: undefined,
                  availableMemoryMiB: undefined,
                  allocatableCoreUnits: undefined,
                  availableCoreUnits: undefined,
                }),
              )
            : [
                {
                  product: "",
                  quantity: allocatableGroup.quantity ?? 0,
                  availableQuantity: availableGroup?.quantity ?? 0,
                  allocatableMemoryMiB: undefined,
                  availableMemoryMiB: undefined,
                  allocatableCoreUnits: undefined,
                  availableCoreUnits: undefined,
                },
              ];

      return products.map((productRow) => {
        const fallbackPools = devicePoolsByProduct.get(productRow.product);
        const row = {
          acceleratorType,
          product: productRow.product,
          matchesSelectedAccelerator: false,
          memoryTotalMiB:
            metadataProducts[productRow.product]?.memory_total_mib,
          quantity: buildPoolUsage(
            productRow.quantity,
            productRow.availableQuantity,
          ),
          memory: buildPoolUsage(
            productRow.allocatableMemoryMiB ?? fallbackPools?.memory.total,
            productRow.availableMemoryMiB ?? fallbackPools?.memory.available,
          ),
          core: buildPoolUsage(
            productRow.allocatableCoreUnits ?? fallbackPools?.core.total,
            productRow.availableCoreUnits ?? fallbackPools?.core.available,
          ),
        };

        return {
          ...row,
          matchesSelectedAccelerator: matchesSelectedAccelerator(
            row,
            selectedAccelerator,
          ),
        };
      });
    },
  );
}

export function buildGpuDeviceResourceRows(
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  selectedAccelerator?: SelectedAccelerator | null,
): GpuDeviceResourceRow[] {
  if (!nodeResources) {
    return [];
  }

  return Object.entries(nodeResources)
    .sort(([firstNodeName], [secondNodeName]) =>
      firstNodeName.localeCompare(secondNodeName),
    )
    .flatMap(([nodeName, nodeStatus]) =>
      [...(nodeStatus.devices ?? [])]
        .sort(compareDevicesByOrderThenUuid)
        .map((device, index) => {
          const deviceOrder = getDeviceOrder(device.order);
          const acceleratorType = getProductAcceleratorType(
            nodeStatus.allocatable,
            device.product,
          );
          const row = {
            acceleratorType,
            nodeName,
            uuid: device.uuid,
            shortUuid: shortenUuid(device.uuid),
            gpuNumber: deviceOrder ?? index + 1,
            product: device.product,
            healthy: device.health,
            fullFree: isDeviceAvailableForFullCardAllocation(device),
            matchesSelectedAccelerator: false,
            memory: buildPoolUsage(
              device.allocatable?.memory_mib,
              device.available?.memory_mib,
            ),
            core: buildPoolUsage(
              device.allocatable?.core_units,
              device.available?.core_units,
            ),
          };

          return {
            ...row,
            matchesSelectedAccelerator: matchesSelectedAccelerator(
              row,
              selectedAccelerator,
            ),
          };
        }),
    );
}

type GpuAllocationDevice = {
  availableCoreUnits: number;
  availableMemoryMiB: number;
  id: string;
  nodeName: string;
  totalCoreUnits: number;
  totalMemoryMiB: number;
};

type NodeAllocationState = {
  availableCpu: number | null;
  availableMemory: number | null;
  nodeName: string;
};

const getPositiveFiniteNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

const getFiniteResourceNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : null;

const getRequestedCardsPerReplica = (
  allocationMode: GpuAllocationMode,
  gpuPerReplica: number,
) => {
  if (allocationMode === "fractional") {
    return gpuPerReplica > 0 && gpuPerReplica < 1 ? 1 : 0;
  }

  return Number.isInteger(gpuPerReplica) && gpuPerReplica > 0
    ? gpuPerReplica
    : 0;
};

const getDeviceRequirement = (
  device: GpuAllocationDevice,
  options: {
    allocationMode: GpuAllocationMode;
    coreUnitsPerCard?: number | null;
    gpuPerReplica: number;
    memoryMiBPerCard?: number | null;
  },
) => {
  if (options.allocationMode === "fractional") {
    if (options.gpuPerReplica <= 0 || options.gpuPerReplica >= 1) {
      return null;
    }

    return {
      coreUnits: options.gpuPerReplica * 100,
      memoryMiB: options.gpuPerReplica * device.totalMemoryMiB,
    };
  }

  if (options.allocationMode === "full") {
    return {
      coreUnits: 100,
      memoryMiB: device.totalMemoryMiB,
    };
  }

  const memoryMiB = Number(options.memoryMiBPerCard || 0);
  if (memoryMiB <= 0) {
    return null;
  }

  return {
    coreUnits: Number(options.coreUnitsPerCard || 0),
    memoryMiB,
  };
};

const canDeviceSatisfyGpuRequest = (
  device: GpuAllocationDevice,
  options: {
    allocationMode: GpuAllocationMode;
    coreUnitsPerCard?: number | null;
    gpuPerReplica: number;
    memoryMiBPerCard?: number | null;
  },
) => {
  const requirement = getDeviceRequirement(device, options);
  if (!requirement || requirement.memoryMiB <= 0) {
    return false;
  }

  if (device.availableMemoryMiB < requirement.memoryMiB) {
    return false;
  }

  if (
    requirement.coreUnits > 0 &&
    device.availableCoreUnits < requirement.coreUnits
  ) {
    return false;
  }

  return true;
};

const applyGpuRequestToDevice = (
  device: GpuAllocationDevice,
  options: {
    allocationMode: GpuAllocationMode;
    coreUnitsPerCard?: number | null;
    gpuPerReplica: number;
    memoryMiBPerCard?: number | null;
  },
) => {
  const requirement = getDeviceRequirement(device, options);
  if (!requirement) {
    return device;
  }

  return {
    ...device,
    availableCoreUnits:
      requirement.coreUnits > 0
        ? device.availableCoreUnits - requirement.coreUnits
        : device.availableCoreUnits,
    availableMemoryMiB: device.availableMemoryMiB - requirement.memoryMiB,
  };
};

const canNodeSatisfyReplicaResources = (
  node: NodeAllocationState,
  options: {
    cpuPerReplica?: number | null;
    memoryPerReplica?: number | null;
  },
) => {
  const cpuPerReplica = Number(options.cpuPerReplica || 0);
  const memoryPerReplica = Number(options.memoryPerReplica || 0);

  if (
    cpuPerReplica > 0 &&
    node.availableCpu !== null &&
    node.availableCpu < cpuPerReplica
  ) {
    return false;
  }

  if (
    memoryPerReplica > 0 &&
    node.availableMemory !== null &&
    node.availableMemory < memoryPerReplica
  ) {
    return false;
  }

  return true;
};

const applyReplicaResourcesToNode = (
  node: NodeAllocationState,
  options: {
    cpuPerReplica?: number | null;
    memoryPerReplica?: number | null;
  },
) => {
  const cpuPerReplica = Number(options.cpuPerReplica || 0);
  const memoryPerReplica = Number(options.memoryPerReplica || 0);

  return {
    ...node,
    availableCpu:
      node.availableCpu === null || cpuPerReplica <= 0
        ? node.availableCpu
        : node.availableCpu - cpuPerReplica,
    availableMemory:
      node.availableMemory === null || memoryPerReplica <= 0
        ? node.availableMemory
        : node.availableMemory - memoryPerReplica,
  };
};

const chooseDeviceCombinations = (
  devices: GpuAllocationDevice[],
  count: number,
): GpuAllocationDevice[][] => {
  if (count <= 0) return [[]];
  if (devices.length < count) return [];

  const result: GpuAllocationDevice[][] = [];
  const visit = (
    startIndex: number,
    selectedDevices: GpuAllocationDevice[],
  ) => {
    if (selectedDevices.length === count) {
      result.push(selectedDevices);
      return;
    }

    const remainingSlots = count - selectedDevices.length;
    for (
      let index = startIndex;
      index <= devices.length - remainingSlots;
      index += 1
    ) {
      visit(index + 1, [...selectedDevices, devices[index]]);
    }
  };

  visit(0, []);
  return result;
};

export function calculateGpuRequestCapacity(
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  options: {
    allocationMode: GpuAllocationMode;
    cpuPerReplica?: number | null;
    gpuPerReplica: number;
    selectedAccelerator?: SelectedAccelerator | null;
    memoryMiBPerCard?: number | null;
    coreUnitsPerCard?: number | null;
    memoryPerReplica?: number | null;
    replicaCount?: number | null;
  },
): GpuRequestCapacity {
  const gpuPerReplica = Number(options.gpuPerReplica || 0);
  const replicaCount = Math.max(1, Number(options.replicaCount || 1));
  const cpuPerReplica = Number(options.cpuPerReplica || 0);
  const memoryPerReplica = Number(options.memoryPerReplica || 0);
  const requestedCardsPerReplica = getRequestedCardsPerReplica(
    options.allocationMode,
    gpuPerReplica,
  );
  const baseResult = {
    allocationMode: options.allocationMode,
    canAllocate: false,
    canAllocateCpu: true,
    canAllocateMemory: true,
    matchingDeviceCount: 0,
    maxCardsPerReplica: 0,
    requestedCardsPerReplica,
    requestedCpu: cpuPerReplica * replicaCount,
    requestedMemory: memoryPerReplica * replicaCount,
    requestedTotalCards: requestedCardsPerReplica * replicaCount,
    satisfyingDeviceCount: 0,
    totalAvailableCpu: 0,
    totalAvailableMemory: 0,
    totalAvailableCoreUnits: 0,
    totalAvailableMemoryMiB: 0,
  };

  if (
    !nodeResources ||
    !options.selectedAccelerator?.product ||
    requestedCardsPerReplica <= 0
  ) {
    return baseResult;
  }

  const devices: GpuAllocationDevice[] = [];
  const nodeStates = new Map<string, NodeAllocationState>();

  for (const [nodeName, nodeStatus] of Object.entries(nodeResources)) {
    nodeStates.set(nodeName, {
      availableCpu: getFiniteResourceNumber(nodeStatus.available?.cpu),
      availableMemory: getFiniteResourceNumber(nodeStatus.available?.memory),
      nodeName,
    });

    for (const [deviceIndex, device] of (nodeStatus.devices ?? []).entries()) {
      if (!device.health) {
        continue;
      }

      const acceleratorType = getProductAcceleratorType(
        nodeStatus.allocatable,
        device.product,
      );
      if (
        !matchesSelectedAccelerator(
          { acceleratorType, product: device.product },
          options.selectedAccelerator,
        )
      ) {
        continue;
      }

      devices.push({
        availableCoreUnits: Number(device.available?.core_units || 0),
        availableMemoryMiB: Number(device.available?.memory_mib || 0),
        id: `${nodeName}:${device.uuid}:${deviceIndex}`,
        nodeName,
        totalCoreUnits: getPositiveFiniteNumber(device.allocatable?.core_units),
        totalMemoryMiB: getPositiveFiniteNumber(device.allocatable?.memory_mib),
      });
    }
  }

  const matchingDeviceCount = devices.length;
  const totalAvailableMemoryMiB = devices.reduce(
    (sum, device) => sum + Math.max(0, device.availableMemoryMiB),
    0,
  );
  const totalAvailableCoreUnits = devices.reduce(
    (sum, device) => sum + Math.max(0, device.availableCoreUnits),
    0,
  );
  const satisfyingDeviceCount = devices.filter((device) =>
    canDeviceSatisfyGpuRequest(device, options),
  ).length;
  const nodeStateValues = Array.from(nodeStates.values());
  const hasCpuSignals = nodeStateValues.some(
    (node) => node.availableCpu !== null,
  );
  const hasMemorySignals = nodeStateValues.some(
    (node) => node.availableMemory !== null,
  );
  const totalAvailableCpu = nodeStateValues.reduce(
    (sum, node) => sum + (node.availableCpu ?? 0),
    0,
  );
  const totalAvailableMemory = nodeStateValues.reduce(
    (sum, node) => sum + (node.availableMemory ?? 0),
    0,
  );
  const requestedCpu = cpuPerReplica * replicaCount;
  const requestedMemory = memoryPerReplica * replicaCount;
  const canAllocateCpu = !hasCpuSignals || requestedCpu <= totalAvailableCpu;
  const canAllocateMemory =
    !hasMemorySignals || requestedMemory <= totalAvailableMemory;
  const canAllocateCardsPerReplica = (cardsPerReplica: number) => {
    if (cardsPerReplica <= 0) {
      return true;
    }
    if (cardsPerReplica > satisfyingDeviceCount) {
      return false;
    }
    if (!canAllocateCpu || !canAllocateMemory) {
      return false;
    }

    const remainingDevices = devices.map((device) => ({ ...device }));
    const remainingNodes = new Map(
      Array.from(nodeStates.entries()).map(([nodeName, node]) => [
        nodeName,
        { ...node },
      ]),
    );

    const allocateReplica = (replicaIndex: number): boolean => {
      if (replicaIndex >= replicaCount) {
        return true;
      }

      const nodeNames = Array.from(
        new Set(remainingDevices.map((device) => device.nodeName)),
      ).sort();

      for (const nodeName of nodeNames) {
        const nodeState = remainingNodes.get(nodeName);
        if (!nodeState || !canNodeSatisfyReplicaResources(nodeState, options)) {
          continue;
        }

        const nodeCandidates = remainingDevices
          .filter(
            (device) =>
              device.nodeName === nodeName &&
              canDeviceSatisfyGpuRequest(device, options),
          )
          .sort((first, second) => {
            if (second.availableMemoryMiB !== first.availableMemoryMiB) {
              return second.availableMemoryMiB - first.availableMemoryMiB;
            }
            return second.availableCoreUnits - first.availableCoreUnits;
          });
        const combinations = chooseDeviceCombinations(
          nodeCandidates,
          cardsPerReplica,
        );

        for (const combination of combinations) {
          const nodeSnapshot = { ...nodeState };
          const snapshots = combination.map((device) => {
            const index = remainingDevices.findIndex(
              (remainingDevice) => remainingDevice.id === device.id,
            );
            return { device: remainingDevices[index], index };
          });

          remainingNodes.set(
            nodeName,
            applyReplicaResourcesToNode(nodeState, options),
          );

          for (const snapshot of snapshots) {
            remainingDevices[snapshot.index] = applyGpuRequestToDevice(
              snapshot.device,
              options,
            );
          }

          if (allocateReplica(replicaIndex + 1)) {
            return true;
          }

          for (const snapshot of snapshots) {
            remainingDevices[snapshot.index] = snapshot.device;
          }
          remainingNodes.set(nodeName, nodeSnapshot);
        }
      }

      return false;
    };

    return allocateReplica(0);
  };
  let maxCardsPerReplica = 0;
  for (
    let cardsPerReplica = matchingDeviceCount;
    cardsPerReplica > 0;
    cardsPerReplica -= 1
  ) {
    if (canAllocateCardsPerReplica(cardsPerReplica)) {
      maxCardsPerReplica = cardsPerReplica;
      break;
    }
  }

  return {
    ...baseResult,
    canAllocate: canAllocateCardsPerReplica(requestedCardsPerReplica),
    canAllocateCpu,
    canAllocateMemory,
    matchingDeviceCount,
    requestedCardsPerReplica,
    requestedCpu,
    requestedMemory,
    requestedTotalCards: requestedCardsPerReplica * replicaCount,
    maxCardsPerReplica,
    satisfyingDeviceCount,
    totalAvailableCpu,
    totalAvailableMemory,
    totalAvailableCoreUnits,
    totalAvailableMemoryMiB,
  };
}

export function calculateVgpuCardCapacity(
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  options: {
    selectedAccelerator?: SelectedAccelerator | null;
    memoryMiBPerCard?: number | null;
    coreUnitsPerCard?: number | null;
    replicaCount?: number | null;
  },
): VgpuCardCapacity {
  const capacity = calculateGpuRequestCapacity(nodeResources, {
    allocationMode: "vgpu",
    coreUnitsPerCard: options.coreUnitsPerCard,
    gpuPerReplica: 1,
    memoryMiBPerCard: options.memoryMiBPerCard,
    replicaCount: options.replicaCount,
    selectedAccelerator: options.selectedAccelerator,
  });

  return {
    matchingDeviceCount: capacity.matchingDeviceCount,
    maxCardsPerReplica: capacity.maxCardsPerReplica,
    totalCards:
      capacity.maxCardsPerReplica *
      Math.max(1, Number(options.replicaCount || 1)),
  };
}

export function filterGpuDeviceResourceRows(
  rows: GpuDeviceResourceRow[],
  filters: GpuDeviceResourceFilters,
): GpuDeviceResourceRow[] {
  const nodeName =
    filters.nodeName && filters.nodeName !== GPU_DEVICE_FILTER_ALL
      ? filters.nodeName
      : null;
  const product =
    filters.product && filters.product !== GPU_DEVICE_FILTER_ALL
      ? filters.product
      : null;
  const search = filters.search?.trim().toLowerCase() || "";

  return rows.filter((row) => {
    if (nodeName && row.nodeName !== nodeName) {
      return false;
    }

    if (product && row.product !== product) {
      return false;
    }

    if (!search) {
      return true;
    }

    return [
      row.uuid,
      row.shortUuid,
      `${row.gpuNumber}`,
      `gpu ${row.gpuNumber}`,
      row.product,
      row.nodeName,
    ]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
}

export function getGpuDeviceResourceFilterOptions(
  rows: GpuDeviceResourceRow[],
): { nodeNames: string[]; products: string[] } {
  return {
    nodeNames: Array.from(new Set(rows.map((row) => row.nodeName))).sort(),
    products: Array.from(new Set(rows.map((row) => row.product))).sort(),
  };
}
