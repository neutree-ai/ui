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
  const normalizedTotal = total ?? null;
  const normalizedAvailable = available ?? null;
  const used =
    normalizedTotal == null || normalizedAvailable == null
      ? null
      : normalizedTotal - normalizedAvailable;
  const percent =
    normalizedTotal && normalizedTotal > 0 && used != null
      ? Math.round((used / normalizedTotal) * 100)
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
      result.set(
        device.product,
        current +
          (hasFullCardAvailabilitySignals(device) &&
          isDeviceAvailableForFullCardAllocation(device)
            ? 1
            : 0),
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

const matchesSelectedAccelerator = (
  row: Pick<GpuDeviceResourceRow, "acceleratorType" | "product">,
  selectedAccelerator?: SelectedAccelerator | null,
) => {
  if (!selectedAccelerator?.product && !selectedAccelerator?.type) {
    return true;
  }

  const productMatches =
    !selectedAccelerator.product || row.product === selectedAccelerator.product;
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
              allocatableMemoryMiB: undefined,
              availableMemoryMiB: undefined,
              allocatableCoreUnits: undefined,
              availableCoreUnits: undefined,
            }))
          : Object.entries(allocatableGroup.product_groups ?? {}).map(
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
            );

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
    .flatMap(([nodeName, nodeStatus]) =>
      [...(nodeStatus.devices ?? [])]
        .sort((a, b) => a.uuid.localeCompare(b.uuid))
        .map((device, index) => {
          const acceleratorType = getProductAcceleratorType(
            nodeStatus.allocatable,
            device.product,
          );
          const row = {
            acceleratorType,
            nodeName,
            uuid: device.uuid,
            shortUuid: shortenUuid(device.uuid),
            gpuNumber: index + 1,
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
    )
    .sort(
      (a, b) =>
        a.nodeName.localeCompare(b.nodeName) || a.uuid.localeCompare(b.uuid),
    );
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
