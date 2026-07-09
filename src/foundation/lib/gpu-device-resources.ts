import { matchesAcceleratorName } from "@/foundation/recipe/vram";
import type {
  ClusterResourceInfo,
  DeviceResource,
  EndpointResourceStatus,
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
  totalCards: number;
};

type GpuDeviceResourceFilters = {
  nodeName?: string | null;
  product?: string | null;
  search?: string | null;
};

type PhysicalCardUsageAllocationMode = "full" | "fractional" | "vgpu";

type PhysicalCardUsageOptions = {
  allocationMode: PhysicalCardUsageAllocationMode;
  selectedAccelerator?: SelectedAccelerator | null;
  requestedPerReplica: number;
  replicaCount: number;
  memoryMiBPerCard?: number | null;
  coreUnitsPerCard?: number | null;
};

export const GPU_DEVICE_FILTER_ALL = "__all__";

const MIB_PER_GIB = 1024;
const DEFAULT_VGPU_MEMORY_DISPLAY_PRECISION = 1;

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

const toFiniteNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const capResourceValue = (value: number, total: number | null | undefined) => {
  const normalizedTotal = toFiniteNumber(total);
  return normalizedTotal == null ? value : Math.min(value, normalizedTotal);
};

const getAllocationNodeId = (
  replica: NonNullable<EndpointResourceStatus["replicas"]>[number],
  device: NonNullable<
    NonNullable<EndpointResourceStatus["replicas"]>[number]["devices"]
  >[number],
) => device.node_id || replica.node_id || "";

export function addBackEndpointDeviceAllocationsToNodeResources(
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  endpointResources: EndpointResourceStatus | null | undefined,
  selectedAccelerator?: SelectedAccelerator | null,
): Record<string, NodeResourceStatus> | null | undefined {
  if (!nodeResources || !endpointResources?.replicas?.length) {
    return nodeResources;
  }

  const allocationsByDevice = new Map<
    string,
    { memoryMiB: number; coreUnits: number }
  >();

  for (const replica of endpointResources.replicas) {
    for (const allocation of replica.devices ?? []) {
      const nodeId = getAllocationNodeId(replica, allocation);
      if (!nodeId || !allocation.uuid) continue;
      if (
        selectedAccelerator?.product &&
        !productNamesMatch(allocation.product, selectedAccelerator.product)
      ) {
        continue;
      }

      const memoryMiB = toFiniteNumber(allocation.memory_mib) ?? 0;
      const coreUnits = toFiniteNumber(allocation.core_units) ?? 0;
      const key = `${nodeId}\u0000${allocation.uuid}`;
      const current = allocationsByDevice.get(key) ?? {
        memoryMiB: 0,
        coreUnits: 0,
      };
      allocationsByDevice.set(key, {
        memoryMiB: current.memoryMiB + memoryMiB,
        coreUnits: current.coreUnits + coreUnits,
      });
    }
  }

  if (allocationsByDevice.size === 0) {
    return nodeResources;
  }

  return Object.fromEntries(
    Object.entries(nodeResources).map(([nodeName, nodeStatus]) => {
      const nextDevices = nodeStatus.devices?.map((device) => {
        const allocation = allocationsByDevice.get(
          `${nodeName}\u0000${device.uuid}`,
        );
        if (!allocation) return device;

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
          return device;
        }

        const currentMemoryMiB =
          toFiniteNumber(device.available?.memory_mib) ?? 0;
        const currentCoreUnits =
          toFiniteNumber(device.available?.core_units) ?? 0;

        return {
          ...device,
          available: {
            memory_mib: capResourceValue(
              currentMemoryMiB + allocation.memoryMiB,
              device.allocatable?.memory_mib,
            ),
            core_units: capResourceValue(
              currentCoreUnits + allocation.coreUnits,
              device.allocatable?.core_units,
            ),
          },
        };
      });

      return [
        nodeName,
        nextDevices === nodeStatus.devices
          ? nodeStatus
          : { ...nodeStatus, devices: nextDevices },
      ];
    }),
  );
}

const getDeviceFractionalGpuSlotCapacity = (
  device: DeviceResource,
  requestedPerReplica: number,
) => {
  const availableMemoryMiB = toFiniteNumber(device.available?.memory_mib);
  const allocatableMemoryMiB = toFiniteNumber(device.allocatable?.memory_mib);
  const availableCoreUnits = toFiniteNumber(device.available?.core_units);
  const allocatableCoreUnits = toFiniteNumber(device.allocatable?.core_units);

  if (
    !device.health ||
    availableMemoryMiB == null ||
    allocatableMemoryMiB == null ||
    availableCoreUnits == null ||
    allocatableCoreUnits == null ||
    allocatableMemoryMiB <= 0 ||
    allocatableCoreUnits <= 0 ||
    requestedPerReplica <= 0
  ) {
    return 0;
  }

  const memorySlots = Math.floor(
    availableMemoryMiB / (allocatableMemoryMiB * requestedPerReplica),
  );
  const coreSlots = Math.floor(
    availableCoreUnits / (allocatableCoreUnits * requestedPerReplica),
  );

  return Math.max(0, Math.min(memorySlots, coreSlots));
};

const canDeviceSatisfyVgpuRequest = (
  device: DeviceResource,
  memoryMiBPerCard: number,
  coreUnitsPerCard: number,
) => {
  const availableMemoryMiB = toFiniteNumber(device.available?.memory_mib) ?? 0;
  const availableCoreUnits = toFiniteNumber(device.available?.core_units) ?? 0;

  if (!device.health || memoryMiBPerCard <= 0) {
    return false;
  }

  if (availableMemoryMiB < memoryMiBPerCard) {
    return false;
  }

  if (coreUnitsPerCard > 0 && availableCoreUnits < coreUnitsPerCard) {
    return false;
  }

  return availableCoreUnits > 0;
};

export function calculatePhysicalCardUsageForRequest(
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  options: PhysicalCardUsageOptions,
) {
  const requested = Math.max(
    0,
    Number(options.requestedPerReplica || 0) *
      Math.max(1, Number(options.replicaCount || 1)),
  );
  const memoryMiBPerCard = Number(options.memoryMiBPerCard || 0);
  const coreUnitsPerCard = Number(options.coreUnitsPerCard || 0);
  let available = 0;
  let placementCapacity = 0;

  for (const nodeStatus of Object.values(nodeResources ?? {})) {
    for (const device of nodeStatus.devices ?? []) {
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

      if (options.allocationMode === "fractional") {
        const devicePlacementCapacity = getDeviceFractionalGpuSlotCapacity(
          device,
          Number(options.requestedPerReplica || 0),
        );
        if (devicePlacementCapacity > 0) {
          available += 1;
          placementCapacity += devicePlacementCapacity;
        }
        continue;
      }

      const canSatisfyRequest =
        (options.allocationMode === "full" &&
          isDeviceAvailableForFullCardAllocation(device)) ||
        (options.allocationMode === "vgpu" &&
          canDeviceSatisfyVgpuRequest(
            device,
            memoryMiBPerCard,
            coreUnitsPerCard,
          ));

      if (canSatisfyRequest) {
        available += 1;
        placementCapacity += 1;
      }
    }
  }

  return {
    available,
    placementCapacity,
    requested,
    total: available,
    used: Math.min(requested, available),
  };
}

export function calculateVgpuDevicePlacementCapacity(
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  options: {
    selectedAccelerator?: SelectedAccelerator | null;
    memoryMiBPerCard?: number | null;
    coreUnitsPerCard?: number | null;
  },
) {
  const memoryMiBPerCard = Number(options.memoryMiBPerCard || 0);
  const coreUnitsPerCard = Number(options.coreUnitsPerCard || 0);
  if (memoryMiBPerCard <= 0) return 0;

  let capacity = 0;

  for (const nodeStatus of Object.values(nodeResources ?? {})) {
    for (const device of nodeStatus.devices ?? []) {
      if (!device.health) continue;
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

      const availableMemoryMiB =
        toFiniteNumber(device.available?.memory_mib) ?? 0;
      const availableCoreUnits =
        toFiniteNumber(device.available?.core_units) ?? 0;
      if (availableMemoryMiB <= 0 || availableCoreUnits <= 0) continue;

      const memorySlots = Math.floor(availableMemoryMiB / memoryMiBPerCard);
      const coreSlots =
        coreUnitsPerCard > 0
          ? Math.floor(availableCoreUnits / coreUnitsPerCard)
          : Number.POSITIVE_INFINITY;
      const slots = Math.min(memorySlots, coreSlots);
      if (Number.isFinite(slots)) {
        capacity += Math.max(0, slots);
      } else {
        capacity += Math.max(0, memorySlots);
      }
    }
  }

  return capacity;
}

export function sumMatchingDeviceAvailableResources(
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  selectedAccelerator?: SelectedAccelerator | null,
) {
  let memoryMiB = 0;
  let coreUnits = 0;

  for (const nodeStatus of Object.values(nodeResources ?? {})) {
    for (const device of nodeStatus.devices ?? []) {
      if (!device.health) continue;
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

      memoryMiB += toFiniteNumber(device.available?.memory_mib) ?? 0;
      coreUnits += toFiniteNumber(device.available?.core_units) ?? 0;
    }
  }

  return { coreUnits, memoryMiB };
}

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
              availableQuantity:
                fullCardAvailableDevicesByProduct.get(product) ??
                availableGroup?.products?.[product]?.quantity ??
                0,
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
                  availableQuantity:
                    fullCardAvailableDevicesByProduct.get(product) ??
                    availableGroup?.product_groups?.[product] ??
                    0,
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

const getVgpuMemoryDisplayRangeMiB = (
  memoryMiB: number,
  precision = DEFAULT_VGPU_MEMORY_DISPLAY_PRECISION,
) => {
  const memoryGiB = memoryMiB / MIB_PER_GIB;
  const bucketHalfStepGiB = 0.5 / 10 ** precision;

  return {
    lowerMiB: Math.ceil((memoryGiB - bucketHalfStepGiB) * MIB_PER_GIB),
    upperMiB: Math.floor((memoryGiB + bucketHalfStepGiB) * MIB_PER_GIB),
  };
};

const isVgpuMemoryApproximatelySufficient = (
  availableMemoryMiB: number,
  memoryMiBPerCard: number,
) => {
  if (availableMemoryMiB >= memoryMiBPerCard) return true;

  const { lowerMiB, upperMiB } =
    getVgpuMemoryDisplayRangeMiB(memoryMiBPerCard);
  return availableMemoryMiB >= lowerMiB && availableMemoryMiB <= upperMiB;
};

export function calculateVgpuCardCapacity(
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  options: {
    selectedAccelerator?: SelectedAccelerator | null;
    memoryMiBPerCard?: number | null;
    coreUnitsPerCard?: number | null;
  },
): VgpuCardCapacity {
  const memoryMiBPerCard = Number(options.memoryMiBPerCard || 0);
  const coreUnitsPerCard = Number(options.coreUnitsPerCard || 0);

  if (
    !nodeResources ||
    !options.selectedAccelerator?.product ||
    memoryMiBPerCard <= 0
  ) {
    return {
      matchingDeviceCount: 0,
      totalCards: 0,
    };
  }

  let matchingDeviceCount = 0;
  let totalCards = 0;

  for (const nodeStatus of Object.values(nodeResources)) {
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
          options.selectedAccelerator,
        )
      ) {
        continue;
      }

      matchingDeviceCount += 1;
      const availableMemoryMiB = Number(device.available?.memory_mib || 0);
      const availableCoreUnits = Number(device.available?.core_units || 0);
      if (availableMemoryMiB <= 0 || availableCoreUnits <= 0) {
        continue;
      }

      if (coreUnitsPerCard > 0 && availableCoreUnits < coreUnitsPerCard) {
        continue;
      }

      if (
        !isVgpuMemoryApproximatelySufficient(
          availableMemoryMiB,
          memoryMiBPerCard,
        )
      ) {
        continue;
      }

      totalCards += 1;
    }
  }

  return {
    matchingDeviceCount,
    totalCards,
  };
}

export function calculateVgpuMemoryBoundaryMiB(
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  options: {
    selectedAccelerator?: SelectedAccelerator | null;
    requestedCardCount?: number | null;
    coreUnitsPerCard?: number | null;
  },
) {
  if (!nodeResources) return null;

  const requestedCardCount = Math.max(
    1,
    Math.ceil(Number(options.requestedCardCount || 1)),
  );
  const coreUnitsPerCard = Number(options.coreUnitsPerCard || 0);
  const devices: Array<{
    availableCoreUnits: number;
    availableMemoryMiB: number;
  }> = [];

  for (const nodeStatus of Object.values(nodeResources)) {
    for (const device of nodeStatus.devices ?? []) {
      if (!device.health) continue;

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

      const availableMemoryMiB = Number(device.available?.memory_mib || 0);
      const availableCoreUnits = Number(device.available?.core_units || 0);
      if (availableMemoryMiB <= 0 || availableCoreUnits <= 0) continue;

      devices.push({ availableCoreUnits, availableMemoryMiB });
    }
  }

  const candidateDevices = devices
    .filter(
      (device) =>
        coreUnitsPerCard <= 0 || device.availableCoreUnits >= coreUnitsPerCard,
    )
    .sort((left, right) => right.availableMemoryMiB - left.availableMemoryMiB);

  const boundaryDevice = candidateDevices[requestedCardCount - 1];
  return boundaryDevice?.availableMemoryMiB > 0
    ? boundaryDevice.availableMemoryMiB
    : null;
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
