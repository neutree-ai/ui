import {
  compareDevicesByOrderThenUuid,
  getDeviceOrder,
  mergePoolTotals,
} from "@/foundation/lib/device-resource-utils";
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

/** Narrowest a GPU cell can get before its VRAM bar and labels stop being
 * readable. Below this the row scrolls horizontally rather than compressing. */
const GPU_GRID_MIN_COLUMN_WIDTH = 172;

/** Style for a one-row-per-node grid of GPU cells.
 *
 * `minWidth` is not redundant with the track floor. A grid box sizes to its
 * container, so tracks held at `minmax(172px, …)` overflow that box once the
 * container is narrower than `columns * 172` — and the rounded frame clips them,
 * which hides cards outright instead of letting an ancestor scroll to them.
 * Growing the box with its tracks is what turns the overflow into scrolling, so
 * the two numbers have to be derived together.
 *
 * `content-box` opts this one element out of the global border-box default so
 * the frame's own border sits outside that width. Under border-box the border
 * eats into it and the last cell loses its right edge to the same clip.
 */
export const getGpuCellGridStyle = (columns: number) => ({
  gridTemplateColumns: `repeat(${columns}, minmax(${GPU_GRID_MIN_COLUMN_WIDTH}px, 1fr))`,
  minWidth: `${columns * GPU_GRID_MIN_COLUMN_WIDTH}px`,
  boxSizing: "content-box" as const,
});

/* A GPU cell is one card rendered by two callers: the cluster device grid and
 * the endpoint runtime grid. They show different numbers, but they are the same
 * card, and users compare them across pages. Holding the chrome here is what
 * keeps one of them from drifting two pixels away from the other. */

/** Cell surface and padding. */
export const GPU_CELL_CLASS =
  "min-w-0 bg-[var(--nt-fill-neutral-opaque-1)] p-2.5";

/** Usage bar geometry. Height is deliberate: below 8px the fill of a
 * lightly-used device reads as a rendering artefact rather than a value. */
export const GPU_USAGE_BAR_CLASS = "h-2 rounded-full border";

/** Default (non-alerting) usage bar track. */
export const GPU_USAGE_BAR_TRACK_CLASS =
  "border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-opaque-2)]";

/** Track for a bar with no measurement behind it — an unhealthy card, or a
 * device the backend reported without a resource pool. A dashed, unfilled track
 * reads as "no reading", where a solid empty track reads as "zero used". */
export const GPU_USAGE_BAR_EMPTY_CLASS =
  "border-dashed border-[var(--nt-stroke-neutral-trans-3)] bg-transparent";

/** Chrome for a cell whose device is out of service. Uses the same disabled
 * fill and tertiary text as the shared form controls, so "inert" looks the same
 * here as everywhere else — and stays legible, unlike a blanket opacity drop. */
export const GPU_CELL_INERT_CLASS =
  "bg-[var(--nt-fill-neutral-trans-3)] text-[var(--nt-text-neutral-tertiary)]";

/** Supporting text under or beside a usage bar. */
export const GPU_USAGE_TEXT_CLASS = "text-[11px] leading-4";

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

export const getFractionalGpuCoreRequirement = (
  gpuPerReplica: number | null | undefined,
  totalCoreUnits: number | null | undefined,
) => {
  const normalizedGpuPerReplica = toFiniteNumber(gpuPerReplica);
  const normalizedTotalCoreUnits = toFiniteNumber(totalCoreUnits);
  if (
    normalizedGpuPerReplica == null ||
    normalizedTotalCoreUnits == null ||
    normalizedGpuPerReplica <= 0 ||
    normalizedGpuPerReplica >= 1 ||
    normalizedTotalCoreUnits <= 0
  ) {
    return null;
  }

  const requiredCoreUnits = normalizedGpuPerReplica * normalizedTotalCoreUnits;
  return Number.isFinite(requiredCoreUnits) && requiredCoreUnits > 0
    ? requiredCoreUnits
    : null;
};

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

const getReplicaNodeId = (
  replica: NonNullable<EndpointResourceStatus["replicas"]>[number],
) => {
  if (replica.node_id) return replica.node_id;

  const deviceNodeIds = new Set(
    (replica.devices ?? [])
      .map((device) => device.node_id)
      .filter((nodeId): nodeId is string => Boolean(nodeId)),
  );

  return deviceNodeIds.size === 1 ? [...deviceNodeIds][0] : null;
};

type EndpointResourceAddBackOptions = {
  cpuPerReplica?: number | null;
  memoryPerReplica?: number | null;
};

export function addBackEndpointDeviceAllocationsToNodeResources(
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  endpointResources: EndpointResourceStatus | null | undefined,
  selectedAccelerator?: SelectedAccelerator | null,
  options?: EndpointResourceAddBackOptions,
): Record<string, NodeResourceStatus> | null | undefined {
  if (!nodeResources || !endpointResources?.replicas?.length) {
    return nodeResources;
  }

  const replicas = endpointResources.replicas;
  const cpuPerReplica = Math.max(0, Number(options?.cpuPerReplica || 0));
  const memoryPerReplica = Math.max(0, Number(options?.memoryPerReplica || 0));
  const replicaNodeIds = replicas.map(getReplicaNodeId);
  // GPU-only replicas can request zero CPU and memory; node topology alone
  // determines whether restoring their node-level allocation is safe.
  const canRestoreNodeResources = replicaNodeIds.every(Boolean);

  const allocationsByDevice = new Map<
    string,
    { memoryMiB: number; coreUnits: number }
  >();

  for (const replica of replicas) {
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

  return Object.fromEntries(
    Object.entries(nodeResources).map(([nodeName, nodeStatus]) => {
      let changed = false;
      const nextDevices =
        allocationsByDevice.size === 0
          ? nodeStatus.devices
          : nodeStatus.devices?.map((device) => {
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

              const currentMemoryMiB = toFiniteNumber(
                device.available?.memory_mib,
              );
              const currentCoreUnits = toFiniteNumber(
                device.available?.core_units,
              );
              if (currentMemoryMiB == null || currentCoreUnits == null) {
                return device;
              }
              changed = true;

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

      let nextAvailable = nodeStatus.available;
      if (canRestoreNodeResources && nodeStatus.available) {
        const replicaCountOnNode = replicaNodeIds.filter(
          (replicaNodeId) => replicaNodeId === nodeName,
        ).length;
        if (replicaCountOnNode > 0) {
          const currentCpu = toFiniteNumber(nodeStatus.available.cpu);
          const currentMemory = toFiniteNumber(nodeStatus.available.memory);
          const nextCpu =
            currentCpu == null
              ? currentCpu
              : capResourceValue(
                  currentCpu + cpuPerReplica * replicaCountOnNode,
                  nodeStatus.allocatable?.cpu,
                );
          const nextMemory =
            currentMemory == null
              ? currentMemory
              : capResourceValue(
                  currentMemory + memoryPerReplica * replicaCountOnNode,
                  nodeStatus.allocatable?.memory,
                );
          if (nextCpu !== currentCpu || nextMemory !== currentMemory) {
            changed = true;
            nextAvailable = {
              ...nodeStatus.available,
              cpu: nextCpu ?? nodeStatus.available.cpu,
              memory: nextMemory ?? nodeStatus.available.memory,
            };
          }
        }
      }

      return [
        nodeName,
        changed
          ? { ...nodeStatus, available: nextAvailable, devices: nextDevices }
          : nodeStatus,
      ];
    }),
  );
}

const getDeviceFractionalGpuSlotCapacity = (
  device: DeviceResource,
  requestedPerReplica: number,
) => {
  const availableCoreUnits = toFiniteNumber(device.available?.core_units);
  const requiredCoreUnits = getFractionalGpuCoreRequirement(
    requestedPerReplica,
    device.allocatable?.core_units,
  );

  if (
    !device.health ||
    availableCoreUnits == null ||
    requiredCoreUnits == null
  ) {
    return 0;
  }

  return Math.max(0, Math.floor(availableCoreUnits / requiredCoreUnits));
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

type GpuPlacementAllocationMode = "full" | "fractional" | "vgpu";
type GpuPlacementStatus = "pass" | "fail" | "unknown";

type GpuPlacementCapacity = {
  canAllocate: boolean | null;
  canAllocateCpu: boolean | null;
  canAllocateMemory: boolean | null;
  cpuPlacement: GpuPlacementStatus;
  gpu: GpuPlacementStatus;
  cpu: GpuPlacementStatus;
  memory: GpuPlacementStatus;
  memoryPlacement: GpuPlacementStatus;
  overall: GpuPlacementStatus;
  matchingDeviceCount: number;
  maxCardsPerReplica: number;
  maxFullGpuCardsPerNode: number;
  maxGpuPlaceableReplicas: number | null;
  maxPlaceableReplicas: number | null;
  requestedCardsPerReplica: number;
  satisfyingDeviceCount: number;
  totalAvailableCoreUnits: number;
  totalAvailableCpu: number;
  totalAvailableMemory: number;
  totalAvailableMemoryMiB: number;
};

type GpuPlacementOptions = {
  allocationMode: GpuPlacementAllocationMode;
  coreUnitsPerCard?: number | null;
  cpuPerReplica?: number | null;
  gpuPerReplica: number;
  memoryMiBPerCard?: number | null;
  memoryPerReplica?: number | null;
  replicaCount?: number | null;
  selectedAccelerator?: SelectedAccelerator | null;
};

type PlacementDeviceState = {
  availableCoreUnits: number;
  availableMemoryMiB: number;
  id: string;
  nodeName: string;
  totalCoreUnits: number;
  totalMemoryMiB: number;
  uuid: string;
};

type PlacementNodeState = {
  availableCpu: number | null;
  availableMemory: number | null;
  devices: PlacementDeviceState[];
  hasUnknownDeviceSignals: boolean;
  nodeName: string;
  topologyKnown: boolean;
};

type PlacementSnapshot = {
  hasUnknownCpuSignals: boolean;
  hasUnknownMemorySignals: boolean;
  hasUnknownTopology: boolean;
  matchingDeviceCount: number;
  nodes: PlacementNodeState[];
  satisfyingDeviceCount: number;
  totalAvailableCoreUnits: number;
  totalAvailableCpu: number;
  totalAvailableMemory: number;
  totalAvailableMemoryMiB: number;
};

type PlacementRequirement = {
  coreUnits: number;
  memoryMiB: number;
};

type PlacementSearchResult = {
  capacity: number;
  indeterminate: boolean;
};

type MinimumPhysicalCardSearchResult = {
  indeterminate: boolean;
  physicalCardCount: number | null;
};

type PlacementSearchContext = {
  exhausted: boolean;
  memo: Map<string, boolean>;
  states: number;
};

const PLACEMENT_SEARCH_STATE_LIMIT = 20_000;
const PLACEMENT_REPLICA_LIMIT = 256;

const placementStatusToBoolean = (
  status: GpuPlacementStatus,
): boolean | null => {
  if (status === "pass") return true;
  if (status === "fail") return false;
  return null;
};

const getRequestedCardsPerReplica = (
  allocationMode: GpuPlacementAllocationMode,
  gpuPerReplica: number,
) => {
  if (allocationMode === "fractional") {
    return gpuPerReplica > 0 && gpuPerReplica < 1 ? 1 : 0;
  }

  return Number.isInteger(gpuPerReplica) && gpuPerReplica > 0
    ? gpuPerReplica
    : 0;
};

const getPlacementRequirement = (
  device: PlacementDeviceState,
  options: GpuPlacementOptions,
): PlacementRequirement | null => {
  if (options.allocationMode === "fractional") {
    const coreUnits = getFractionalGpuCoreRequirement(
      options.gpuPerReplica,
      device.totalCoreUnits,
    );
    if (coreUnits == null) return null;

    return {
      memoryMiB: 0,
      coreUnits,
    };
  }

  if (options.allocationMode === "full") {
    return {
      memoryMiB: device.totalMemoryMiB,
      coreUnits: device.totalCoreUnits,
    };
  }

  const memoryMiB = toFiniteNumber(options.memoryMiBPerCard) ?? 0;
  const coreUnits = Math.max(0, toFiniteNumber(options.coreUnitsPerCard) ?? 0);
  return memoryMiB > 0 ? { memoryMiB, coreUnits } : null;
};

const canPlacementDeviceSatisfy = (
  device: PlacementDeviceState,
  requirement: PlacementRequirement | null,
) => {
  if (!requirement) return false;

  const requiresMemory = requirement.memoryMiB > 0;
  const requiresCore = requirement.coreUnits > 0;
  if (!requiresMemory && !requiresCore) return false;
  if (requiresMemory && device.availableMemoryMiB < requirement.memoryMiB) {
    return false;
  }

  return !requiresCore || device.availableCoreUnits >= requirement.coreUnits;
};

const consumePlacementDevice = (
  device: PlacementDeviceState,
  requirement: PlacementRequirement,
): PlacementDeviceState => ({
  ...device,
  availableMemoryMiB: device.availableMemoryMiB - requirement.memoryMiB,
  availableCoreUnits:
    requirement.coreUnits > 0
      ? device.availableCoreUnits - requirement.coreUnits
      : device.availableCoreUnits,
});

const normalizePlacementReplicaCount = (value: number | null | undefined) =>
  Math.max(1, Math.floor(Number(value || 1)));

const placementNumberKey = (value: number | null) =>
  value == null ? "?" : String(Math.round(value * 1_000_000) / 1_000_000);

const placementStateKey = (
  remainingReplicas: number,
  availableCpu: number | null,
  availableMemory: number | null,
  devices: PlacementDeviceState[],
) =>
  [
    remainingReplicas,
    placementNumberKey(availableCpu),
    placementNumberKey(availableMemory),
    ...devices
      .map(
        (device) =>
          `${device.id}:${placementNumberKey(device.availableMemoryMiB)}:${placementNumberKey(device.availableCoreUnits)}`,
      )
      .sort(),
  ].join("|");

const enumeratePlacementCombinations = (
  candidates: PlacementDeviceState[],
  count: number,
  visit: (devices: PlacementDeviceState[]) => boolean,
) => {
  const selected: PlacementDeviceState[] = [];
  const selectedUuids = new Set<string>();

  const walk = (startIndex: number): boolean => {
    if (selected.length === count) return visit(selected);

    const remaining = count - selected.length;
    for (
      let index = startIndex;
      index <= candidates.length - remaining;
      index += 1
    ) {
      const candidate = candidates[index];
      if (selectedUuids.has(candidate.uuid)) continue;

      selected.push(candidate);
      selectedUuids.add(candidate.uuid);
      if (walk(index + 1)) return true;
      selected.pop();
      selectedUuids.delete(candidate.uuid);
    }

    return false;
  };

  return walk(0);
};

const canPlaceReplicasOnNode = (
  node: PlacementNodeState,
  options: GpuPlacementOptions,
  cardsPerReplica: number,
  replicaCount: number,
): { feasible: boolean; indeterminate: boolean } => {
  const cpuPerReplica = Math.max(0, Number(options.cpuPerReplica || 0));
  const memoryPerReplica = Math.max(0, Number(options.memoryPerReplica || 0));
  const requirementFor = (device: PlacementDeviceState) =>
    getPlacementRequirement(device, options);
  const context: PlacementSearchContext = {
    exhausted: false,
    memo: new Map(),
    states: 0,
  };

  const search = (
    remainingReplicas: number,
    availableCpu: number | null,
    availableMemory: number | null,
    devices: PlacementDeviceState[],
  ): boolean => {
    if (remainingReplicas === 0) return true;
    if (context.exhausted) return false;

    const stateKey = placementStateKey(
      remainingReplicas,
      availableCpu,
      availableMemory,
      devices,
    );
    const cached = context.memo.get(stateKey);
    if (cached !== undefined) return cached;

    context.states += 1;
    if (context.states > PLACEMENT_SEARCH_STATE_LIMIT) {
      context.exhausted = true;
      return false;
    }

    if (
      (cpuPerReplica > 0 &&
        (availableCpu == null || availableCpu < cpuPerReplica)) ||
      (memoryPerReplica > 0 &&
        (availableMemory == null || availableMemory < memoryPerReplica))
    ) {
      context.memo.set(stateKey, false);
      return false;
    }

    const candidates = devices
      .filter((device) =>
        canPlacementDeviceSatisfy(device, requirementFor(device)),
      )
      .sort(
        (first, second) =>
          second.availableMemoryMiB - first.availableMemoryMiB ||
          second.availableCoreUnits - first.availableCoreUnits ||
          first.id.localeCompare(second.id),
      );
    if (candidates.length < cardsPerReplica) {
      context.memo.set(stateKey, false);
      return false;
    }

    const nextCpu = availableCpu == null ? null : availableCpu - cpuPerReplica;
    const nextMemory =
      availableMemory == null ? null : availableMemory - memoryPerReplica;
    const found = enumeratePlacementCombinations(
      candidates,
      cardsPerReplica,
      (selectedDevices) => {
        const selectedIds = new Set(selectedDevices.map((device) => device.id));
        const nextDevices = devices.map((device) => {
          if (!selectedIds.has(device.id)) return device;
          const requirement = requirementFor(device);
          return requirement
            ? consumePlacementDevice(device, requirement)
            : device;
        });

        return search(remainingReplicas - 1, nextCpu, nextMemory, nextDevices);
      },
    );
    context.memo.set(stateKey, found);
    return found;
  };

  const feasible = search(
    replicaCount,
    node.availableCpu,
    node.availableMemory,
    node.devices,
  );
  return { feasible, indeterminate: context.exhausted };
};

const getNodeMinimumPhysicalCardUsage = (
  node: PlacementNodeState,
  options: GpuPlacementOptions,
  cardsPerReplica: number,
  replicaCount: number,
): MinimumPhysicalCardSearchResult => {
  if (replicaCount === 0) {
    return { indeterminate: false, physicalCardCount: 0 };
  }

  const cpuPerReplica = Math.max(0, Number(options.cpuPerReplica || 0));
  const memoryPerReplica = Math.max(0, Number(options.memoryPerReplica || 0));
  const requirementFor = (device: PlacementDeviceState) =>
    getPlacementRequirement(device, options);
  const context: PlacementSearchContext = {
    exhausted: false,
    memo: new Map(),
    states: 0,
  };
  let minimumPhysicalCardCount = Number.POSITIVE_INFINITY;

  const search = (
    remainingReplicas: number,
    availableCpu: number | null,
    availableMemory: number | null,
    devices: PlacementDeviceState[],
    usedDeviceIds: ReadonlySet<string>,
  ): void => {
    if (usedDeviceIds.size >= minimumPhysicalCardCount || context.exhausted) {
      return;
    }
    if (remainingReplicas === 0) {
      minimumPhysicalCardCount = usedDeviceIds.size;
      return;
    }

    const usedDeviceKey = Array.from(usedDeviceIds).sort().join(",");
    const stateKey = `${placementStateKey(
      remainingReplicas,
      availableCpu,
      availableMemory,
      devices,
    )}|${usedDeviceKey}`;
    if (context.memo.has(stateKey)) return;
    context.memo.set(stateKey, true);

    context.states += 1;
    if (context.states > PLACEMENT_SEARCH_STATE_LIMIT) {
      context.exhausted = true;
      return;
    }

    if (
      (cpuPerReplica > 0 &&
        (availableCpu == null || availableCpu < cpuPerReplica)) ||
      (memoryPerReplica > 0 &&
        (availableMemory == null || availableMemory < memoryPerReplica))
    ) {
      return;
    }

    const candidates = devices
      .filter((device) =>
        canPlacementDeviceSatisfy(device, requirementFor(device)),
      )
      .sort(
        (first, second) =>
          Number(usedDeviceIds.has(second.id)) -
            Number(usedDeviceIds.has(first.id)) ||
          second.availableMemoryMiB - first.availableMemoryMiB ||
          second.availableCoreUnits - first.availableCoreUnits ||
          first.id.localeCompare(second.id),
      );
    if (candidates.length < cardsPerReplica) return;

    const nextCpu = availableCpu == null ? null : availableCpu - cpuPerReplica;
    const nextMemory =
      availableMemory == null ? null : availableMemory - memoryPerReplica;
    enumeratePlacementCombinations(
      candidates,
      cardsPerReplica,
      (selectedDevices) => {
        const selectedIds = new Set(selectedDevices.map((device) => device.id));
        const nextDevices = devices.map((device) => {
          if (!selectedIds.has(device.id)) return device;
          const requirement = requirementFor(device);
          return requirement
            ? consumePlacementDevice(device, requirement)
            : device;
        });
        const nextUsedDeviceIds = new Set(usedDeviceIds);
        for (const device of selectedDevices) {
          nextUsedDeviceIds.add(device.id);
        }

        search(
          remainingReplicas - 1,
          nextCpu,
          nextMemory,
          nextDevices,
          nextUsedDeviceIds,
        );
        return false;
      },
    );
  };

  search(
    replicaCount,
    node.availableCpu,
    node.availableMemory,
    node.devices,
    new Set(),
  );
  return {
    indeterminate: context.exhausted,
    physicalCardCount: Number.isFinite(minimumPhysicalCardCount)
      ? minimumPhysicalCardCount
      : null,
  };
};

const getNodeReplicaUpperBound = (
  node: PlacementNodeState,
  options: GpuPlacementOptions,
  cardsPerReplica: number,
) => {
  if (cardsPerReplica <= 0) return 0;

  let deviceReplicaBound = 0;
  for (const device of node.devices) {
    const requirement = getPlacementRequirement(device, options);
    if (!requirement || !canPlacementDeviceSatisfy(device, requirement)) {
      continue;
    }

    const memoryBound =
      requirement.memoryMiB > 0
        ? Math.floor(
            Math.max(0, device.availableMemoryMiB) / requirement.memoryMiB,
          )
        : Number.POSITIVE_INFINITY;
    const coreBound =
      requirement.coreUnits > 0
        ? Math.floor(
            Math.max(0, device.availableCoreUnits) / requirement.coreUnits,
          )
        : Number.POSITIVE_INFINITY;
    deviceReplicaBound += Math.min(memoryBound, coreBound);
  }

  let upperBound = Math.floor(deviceReplicaBound / cardsPerReplica);
  const cpuPerReplica = Math.max(0, Number(options.cpuPerReplica || 0));
  if (cpuPerReplica > 0 && node.availableCpu != null) {
    upperBound = Math.min(
      upperBound,
      Math.floor(Math.max(0, node.availableCpu) / cpuPerReplica),
    );
  }
  const memoryPerReplica = Math.max(0, Number(options.memoryPerReplica || 0));
  if (memoryPerReplica > 0 && node.availableMemory != null) {
    upperBound = Math.min(
      upperBound,
      Math.floor(Math.max(0, node.availableMemory) / memoryPerReplica),
    );
  }

  return Math.max(0, Math.min(upperBound, PLACEMENT_REPLICA_LIMIT));
};

const getNodeMaxReplicaCapacity = (
  node: PlacementNodeState,
  options: GpuPlacementOptions,
  cardsPerReplica: number,
): PlacementSearchResult => {
  const upperBound = getNodeReplicaUpperBound(node, options, cardsPerReplica);
  if (upperBound <= 0) return { capacity: 0, indeterminate: false };

  for (let replicaCount = 1; replicaCount <= upperBound; replicaCount += 1) {
    const result = canPlaceReplicasOnNode(
      node,
      options,
      cardsPerReplica,
      replicaCount,
    );
    if (result.indeterminate) {
      return { capacity: Math.max(0, replicaCount - 1), indeterminate: true };
    }
    if (!result.feasible) {
      return { capacity: replicaCount - 1, indeterminate: false };
    }
  }

  return {
    capacity: upperBound,
    indeterminate: upperBound === PLACEMENT_REPLICA_LIMIT,
  };
};

const buildPlacementSnapshot = (
  nodeResources: Record<string, NodeResourceStatus>,
  options: GpuPlacementOptions,
): PlacementSnapshot => {
  const nodes: PlacementNodeState[] = [];
  let matchingDeviceCount = 0;
  let satisfyingDeviceCount = 0;
  let hasUnknownTopology = false;
  let hasUnknownCpuSignals = false;
  let hasUnknownMemorySignals = false;
  let totalAvailableCpu = 0;
  let totalAvailableMemory = 0;
  let totalAvailableMemoryMiB = 0;
  let totalAvailableCoreUnits = 0;

  for (const [nodeName, nodeStatus] of Object.entries(nodeResources)) {
    const availableCpu = toFiniteNumber(nodeStatus.available?.cpu);
    const availableMemory = toFiniteNumber(nodeStatus.available?.memory);
    if (availableCpu == null) hasUnknownCpuSignals = true;
    if (availableMemory == null) hasUnknownMemorySignals = true;
    if (availableCpu != null) totalAvailableCpu += Math.max(0, availableCpu);
    if (availableMemory != null)
      totalAvailableMemory += Math.max(0, availableMemory);

    const topologyKnown = Array.isArray(nodeStatus.devices);
    if (!topologyKnown) hasUnknownTopology = true;

    const devices: PlacementDeviceState[] = [];
    let hasUnknownDeviceSignals = !topologyKnown;
    for (const [deviceIndex, device] of (nodeStatus.devices ?? []).entries()) {
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

      matchingDeviceCount += 1;
      const totalMemoryMiB = toFiniteNumber(device.allocatable?.memory_mib);
      const availableMemoryMiB = toFiniteNumber(device.available?.memory_mib);
      const totalCoreUnits = toFiniteNumber(device.allocatable?.core_units);
      const availableCoreUnits = toFiniteNumber(device.available?.core_units);
      const memoryRequired = options.allocationMode !== "fractional";
      const coreRequired =
        options.allocationMode !== "vgpu" ||
        (toFiniteNumber(options.coreUnitsPerCard) ?? 0) > 0;
      if (
        (memoryRequired &&
          (totalMemoryMiB == null || availableMemoryMiB == null)) ||
        (coreRequired && (totalCoreUnits == null || availableCoreUnits == null))
      ) {
        hasUnknownDeviceSignals = true;
        continue;
      }

      const placementDevice: PlacementDeviceState = {
        availableCoreUnits: Math.max(0, availableCoreUnits ?? 0),
        availableMemoryMiB: Math.max(0, availableMemoryMiB ?? 0),
        id: `${nodeName}:${device.uuid}:${deviceIndex}`,
        nodeName,
        totalCoreUnits: Math.max(0, totalCoreUnits ?? 0),
        totalMemoryMiB: Math.max(0, totalMemoryMiB ?? 0),
        uuid: device.uuid || `${nodeName}:${deviceIndex}`,
      };
      devices.push(placementDevice);
      totalAvailableMemoryMiB += placementDevice.availableMemoryMiB;
      totalAvailableCoreUnits += placementDevice.availableCoreUnits;
      if (
        canPlacementDeviceSatisfy(
          placementDevice,
          getPlacementRequirement(placementDevice, options),
        )
      ) {
        satisfyingDeviceCount += 1;
      }
    }

    nodes.push({
      availableCpu,
      availableMemory,
      devices,
      hasUnknownDeviceSignals,
      nodeName,
      topologyKnown,
    });
  }

  return {
    hasUnknownCpuSignals,
    hasUnknownMemorySignals,
    hasUnknownTopology,
    matchingDeviceCount,
    nodes,
    satisfyingDeviceCount,
    totalAvailableCoreUnits,
    totalAvailableCpu,
    totalAvailableMemory,
    totalAvailableMemoryMiB,
  };
};

export function calculateVgpuPhysicalCardUsage(
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  options: GpuPlacementOptions,
): number | null {
  if (
    options.allocationMode !== "vgpu" ||
    !nodeResources ||
    !options.selectedAccelerator?.product
  ) {
    return null;
  }

  const replicaCount = normalizePlacementReplicaCount(options.replicaCount);
  const cardsPerReplica = getRequestedCardsPerReplica(
    options.allocationMode,
    Number(options.gpuPerReplica || 0),
  );
  if (cardsPerReplica <= 0 || replicaCount > PLACEMENT_REPLICA_LIMIT) {
    return null;
  }

  const snapshot = buildPlacementSnapshot(nodeResources, options);
  const requiresCpu = Number(options.cpuPerReplica || 0) > 0;
  const requiresMemory = Number(options.memoryPerReplica || 0) > 0;
  if (
    snapshot.hasUnknownTopology ||
    snapshot.nodes.some(
      (node) =>
        node.hasUnknownDeviceSignals ||
        (requiresCpu && node.availableCpu == null) ||
        (requiresMemory && node.availableMemory == null),
    )
  ) {
    return null;
  }

  let bestByReplicaCount = Array.from(
    { length: replicaCount + 1 },
    (_, index) => (index === 0 ? 0 : Number.POSITIVE_INFINITY),
  );
  for (const node of snapshot.nodes) {
    const nodeUsageByReplicaCount = [0];
    for (let count = 1; count <= replicaCount; count += 1) {
      const result = getNodeMinimumPhysicalCardUsage(
        node,
        options,
        cardsPerReplica,
        count,
      );
      if (result.indeterminate) return null;
      nodeUsageByReplicaCount.push(
        result.physicalCardCount ?? Number.POSITIVE_INFINITY,
      );
    }

    const nextBest = Array.from(
      { length: replicaCount + 1 },
      () => Number.POSITIVE_INFINITY,
    );
    for (let placed = 0; placed <= replicaCount; placed += 1) {
      if (!Number.isFinite(bestByReplicaCount[placed])) continue;
      for (let onNode = 0; placed + onNode <= replicaCount; onNode += 1) {
        const nodeUsage = nodeUsageByReplicaCount[onNode];
        if (!Number.isFinite(nodeUsage)) continue;
        const totalUsage = bestByReplicaCount[placed] + nodeUsage;
        const nextCount = placed + onNode;
        nextBest[nextCount] = Math.min(nextBest[nextCount], totalUsage);
      }
    }
    bestByReplicaCount = nextBest;
  }

  const physicalCardCount = bestByReplicaCount[replicaCount];
  return Number.isFinite(physicalCardCount) ? physicalCardCount : null;
}

const getAggregateDimensionStatus = (
  requested: number,
  available: number,
  hasUnknownSignals: boolean,
  hasAnySignal: boolean,
): GpuPlacementStatus => {
  if (!hasAnySignal) return "unknown";
  if (available >= requested) return "pass";
  return hasUnknownSignals ? "unknown" : "fail";
};

const solvePlacementForCards = (
  snapshot: PlacementSnapshot,
  options: GpuPlacementOptions,
  cardsPerReplica: number,
): PlacementSearchResult => {
  const requiresCpu = Number(options.cpuPerReplica || 0) > 0;
  const requiresMemory = Number(options.memoryPerReplica || 0) > 0;
  let capacity = 0;
  let indeterminate = false;

  for (const node of snapshot.nodes) {
    const result = getNodeMaxReplicaCapacity(node, options, cardsPerReplica);
    capacity += result.capacity;
    indeterminate ||=
      result.indeterminate ||
      node.hasUnknownDeviceSignals ||
      (requiresCpu && node.availableCpu == null) ||
      (requiresMemory && node.availableMemory == null);
  }

  return { capacity, indeterminate };
};

const getPlacementStatus = (
  placement: PlacementSearchResult,
  snapshot: PlacementSnapshot,
  replicaCount: number,
): GpuPlacementStatus => {
  if (placement.capacity >= replicaCount && !placement.indeterminate) {
    return "pass";
  }
  if (
    snapshot.hasUnknownTopology ||
    snapshot.nodes.some((node) => node.hasUnknownDeviceSignals) ||
    placement.indeterminate
  ) {
    return "unknown";
  }
  return "fail";
};

const getOverallPlacementStatus = (...statuses: GpuPlacementStatus[]) => {
  if (statuses.includes("fail")) return "fail" as const;
  if (statuses.includes("unknown")) return "unknown" as const;
  return "pass" as const;
};

export function calculateGpuPlacementCapacity(
  nodeResources: Record<string, NodeResourceStatus> | null | undefined,
  options: GpuPlacementOptions,
): GpuPlacementCapacity {
  const gpuPerReplica = Number(options.gpuPerReplica || 0);
  const replicaCount = normalizePlacementReplicaCount(options.replicaCount);
  const requestedCardsPerReplica = getRequestedCardsPerReplica(
    options.allocationMode,
    gpuPerReplica,
  );
  const unknownResult = (
    matchingDeviceCount = 0,
    satisfyingDeviceCount = 0,
    totals?: Partial<PlacementSnapshot>,
  ): GpuPlacementCapacity => {
    const overall = "unknown" as const;
    return {
      canAllocate: null,
      canAllocateCpu: null,
      canAllocateMemory: null,
      cpuPlacement: overall,
      gpu: overall,
      cpu: overall,
      memory: overall,
      memoryPlacement: overall,
      overall,
      matchingDeviceCount,
      maxCardsPerReplica: 0,
      maxFullGpuCardsPerNode: 0,
      maxGpuPlaceableReplicas: null,
      maxPlaceableReplicas: null,
      requestedCardsPerReplica,
      satisfyingDeviceCount,
      totalAvailableCoreUnits: totals?.totalAvailableCoreUnits ?? 0,
      totalAvailableCpu: totals?.totalAvailableCpu ?? 0,
      totalAvailableMemory: totals?.totalAvailableMemory ?? 0,
      totalAvailableMemoryMiB: totals?.totalAvailableMemoryMiB ?? 0,
    };
  };

  if (!nodeResources || !options.selectedAccelerator?.product) {
    return unknownResult();
  }

  const snapshot = buildPlacementSnapshot(nodeResources, options);
  const maxFullGpuCardsPerNode =
    options.allocationMode === "full"
      ? snapshot.nodes.reduce(
          (maximum, node) =>
            Math.max(
              maximum,
              node.devices.filter((device) =>
                canPlacementDeviceSatisfy(
                  device,
                  getPlacementRequirement(device, options),
                ),
              ).length,
            ),
          0,
        )
      : 0;
  if (requestedCardsPerReplica <= 0) {
    const invalid: GpuPlacementCapacity = {
      canAllocate: false,
      canAllocateCpu: false,
      canAllocateMemory: false,
      cpuPlacement: "fail",
      gpu: "fail",
      cpu: "fail",
      memory: "fail",
      memoryPlacement: "fail",
      overall: "fail",
      matchingDeviceCount: snapshot.matchingDeviceCount,
      maxCardsPerReplica: 0,
      maxFullGpuCardsPerNode: 0,
      maxGpuPlaceableReplicas: 0,
      maxPlaceableReplicas: 0,
      requestedCardsPerReplica,
      satisfyingDeviceCount: snapshot.satisfyingDeviceCount,
      totalAvailableCoreUnits: snapshot.totalAvailableCoreUnits,
      totalAvailableCpu: snapshot.totalAvailableCpu,
      totalAvailableMemory: snapshot.totalAvailableMemory,
      totalAvailableMemoryMiB: snapshot.totalAvailableMemoryMiB,
    };
    return invalid;
  }

  const cpuPerReplica = Math.max(0, Number(options.cpuPerReplica || 0));
  const memoryPerReplica = Math.max(0, Number(options.memoryPerReplica || 0));
  const requestedCpu = cpuPerReplica * replicaCount;
  const requestedMemory = memoryPerReplica * replicaCount;
  const cpuStatus = getAggregateDimensionStatus(
    requestedCpu,
    snapshot.totalAvailableCpu,
    snapshot.hasUnknownCpuSignals,
    snapshot.nodes.some((node) => node.availableCpu != null),
  );
  const memoryStatus = getAggregateDimensionStatus(
    requestedMemory,
    snapshot.totalAvailableMemory,
    snapshot.hasUnknownMemorySignals,
    snapshot.nodes.some((node) => node.availableMemory != null),
  );

  const gpuOnlyOptions: GpuPlacementOptions = {
    ...options,
    cpuPerReplica: 0,
    memoryPerReplica: 0,
  };
  const cpuPlacementOptions: GpuPlacementOptions = {
    ...options,
    memoryPerReplica: 0,
  };
  const memoryPlacementOptions: GpuPlacementOptions = {
    ...options,
    cpuPerReplica: 0,
  };
  const gpuOnlyPlacement = solvePlacementForCards(
    snapshot,
    gpuOnlyOptions,
    requestedCardsPerReplica,
  );
  const cpuPlacement = solvePlacementForCards(
    snapshot,
    cpuPlacementOptions,
    requestedCardsPerReplica,
  );
  const memoryPlacement = solvePlacementForCards(
    snapshot,
    memoryPlacementOptions,
    requestedCardsPerReplica,
  );
  const requestedPlacement = solvePlacementForCards(
    snapshot,
    options,
    requestedCardsPerReplica,
  );
  const gpuStatus = getPlacementStatus(
    gpuOnlyPlacement,
    snapshot,
    replicaCount,
  );
  const cpuPlacementStatus = getPlacementStatus(
    cpuPlacement,
    snapshot,
    replicaCount,
  );
  const memoryPlacementStatus = getPlacementStatus(
    memoryPlacement,
    snapshot,
    replicaCount,
  );
  const combinedPlacementStatus = getPlacementStatus(
    requestedPlacement,
    snapshot,
    replicaCount,
  );

  const maxPlaceableReplicas =
    combinedPlacementStatus === "unknown" ? null : requestedPlacement.capacity;
  const maxGpuPlaceableReplicas =
    gpuStatus === "unknown" ? null : gpuOnlyPlacement.capacity;

  let maxCardsPerReplica = 0;
  const candidateCardCounts =
    options.allocationMode === "fractional"
      ? [1]
      : Array.from(
          { length: snapshot.matchingDeviceCount },
          (_, index) => snapshot.matchingDeviceCount - index,
        );
  for (const candidate of candidateCardCounts) {
    const result = solvePlacementForCards(snapshot, gpuOnlyOptions, candidate);
    if (
      result.capacity >= replicaCount &&
      !result.indeterminate &&
      !snapshot.hasUnknownTopology &&
      !snapshot.nodes.some((node) => node.hasUnknownDeviceSignals)
    ) {
      maxCardsPerReplica = candidate;
      break;
    }
  }

  const overall = getOverallPlacementStatus(
    gpuStatus,
    cpuStatus,
    memoryStatus,
    combinedPlacementStatus,
  );
  return {
    canAllocate: placementStatusToBoolean(overall),
    canAllocateCpu: placementStatusToBoolean(cpuStatus),
    canAllocateMemory: placementStatusToBoolean(memoryStatus),
    cpuPlacement: cpuPlacementStatus,
    gpu: gpuStatus,
    cpu: cpuStatus,
    memory: memoryStatus,
    memoryPlacement: memoryPlacementStatus,
    overall,
    matchingDeviceCount: snapshot.matchingDeviceCount,
    maxCardsPerReplica,
    maxFullGpuCardsPerNode,
    maxGpuPlaceableReplicas,
    maxPlaceableReplicas,
    requestedCardsPerReplica,
    satisfyingDeviceCount: snapshot.satisfyingDeviceCount,
    totalAvailableCoreUnits: snapshot.totalAvailableCoreUnits,
    totalAvailableCpu: snapshot.totalAvailableCpu,
    totalAvailableMemory: snapshot.totalAvailableMemory,
    totalAvailableMemoryMiB: snapshot.totalAvailableMemoryMiB,
  };
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
  return Object.entries(allocatableGroups).flatMap(
    ([acceleratorType, allocatableGroup]) => {
      const availableGroup =
        resourceInfo?.available?.accelerator_groups?.[acceleratorType];
      const metadataProducts =
        resourceInfo?.accelerator_metadata?.[acceleratorType]?.products ?? {};

      const allocatableProductEntries = Object.entries(
        allocatableGroup.products ?? {},
      );
      const allocatableProductGroupEntries = Object.entries(
        allocatableGroup.product_groups ?? {},
      );
      const availableQuantityForProduct = (
        product: string,
        hasSingleProduct: boolean,
      ) =>
        availableGroup?.products?.[product]?.quantity ??
        availableGroup?.product_groups?.[product] ??
        (hasSingleProduct ? availableGroup?.quantity : undefined) ??
        0;
      const products =
        allocatableProductEntries.length > 0
          ? allocatableProductEntries.map(([product, resources]) => ({
              product,
              quantity: resources.quantity ?? 0,
              availableQuantity: availableQuantityForProduct(
                product,
                allocatableProductEntries.length === 1,
              ),
              allocatableMemoryMiB: resources.virtualization?.memory_mib,
              availableMemoryMiB:
                availableGroup?.products?.[product]?.virtualization?.memory_mib,
              allocatableCoreUnits: resources.virtualization?.core_units,
              availableCoreUnits:
                availableGroup?.products?.[product]?.virtualization?.core_units,
            }))
          : allocatableProductGroupEntries.length > 0
            ? allocatableProductGroupEntries.map(([product, quantity]) => ({
                product,
                quantity,
                availableQuantity: availableQuantityForProduct(
                  product,
                  allocatableProductGroupEntries.length === 1,
                ),
                allocatableMemoryMiB: undefined,
                availableMemoryMiB: undefined,
                allocatableCoreUnits: undefined,
                availableCoreUnits: undefined,
              }))
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

  const { lowerMiB, upperMiB } = getVgpuMemoryDisplayRangeMiB(memoryMiBPerCard);
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
