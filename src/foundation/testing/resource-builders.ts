import type {
  AcceleratorProductResources,
  DeviceResource,
  NodeResourceStatus,
  ResourceInfo,
} from "@/foundation/types/resource-types";

type DevicePool = NonNullable<DeviceResource["allocatable"]>;

/** The physical pool of one whole Tesla-T4: 15 GiB of VRAM, 100 core units. */
export const FULL_T4: DevicePool = { memory_mib: 15360, core_units: 100 };

/**
 * A healthy Tesla-T4 card with `available` left of its full pool. `overrides`
 * replace whole fields (product, health, allocatable, order).
 */
export function makeGpuDevice(
  uuid: string,
  available: DevicePool | null = FULL_T4,
  overrides: Partial<DeviceResource> = {},
): DeviceResource {
  return {
    uuid,
    product: "Tesla-T4",
    health: true,
    allocatable: { ...FULL_T4 },
    available: available && { ...available },
    ...overrides,
  };
}

/** A product entry carrying a vGPU memory and core pool. */
export const vgpuProduct = (
  quantity: number,
  memory_mib: number,
  core_units: number,
): AcceleratorProductResources => ({
  quantity,
  virtualization: { memory_mib, core_units },
});

/**
 * CPU and memory plus one `nvidia_gpu` group whose quantity is the sum of its
 * products. Product counts become `product_groups`; product objects become
 * `products`. Without `gpus` there is no accelerator group.
 */
export function makeResourceInfo(
  cpu: number,
  memory: number,
  gpus?: Record<string, number> | Record<string, AcceleratorProductResources>,
): ResourceInfo {
  if (!gpus) return { cpu, memory, accelerator_groups: null };
  const values = Object.values(gpus);
  const counted = values.every((value) => typeof value === "number");
  const quantity = values.reduce<number>(
    (sum, value) => sum + (typeof value === "number" ? value : value.quantity),
    0,
  );
  return {
    cpu,
    memory,
    accelerator_groups: {
      nvidia_gpu: counted
        ? { quantity, product_groups: gpus as Record<string, number> }
        : {
            quantity,
            product_groups: null,
            products: gpus as Record<string, AcceleratorProductResources>,
          },
    },
  };
}

/** A node that reports only what `overrides` sets; its pools default to null. */
export const makeNodeResources = (
  overrides: Partial<NodeResourceStatus> = {},
): NodeResourceStatus => ({ allocatable: null, available: null, ...overrides });
