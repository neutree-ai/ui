/**
 * AcceleratorType represents the type of accelerator (e.g., "nvidia_gpu", "amd_gpu", "neuron")
 */
export type AcceleratorType = string;

/**
 * AcceleratorProduct represents the product model name (e.g., "Tesla-V100", "Tesla-T4", "MI100")
 */
export type AcceleratorProduct = string;

export type AcceleratorProductResources = {
  quantity: number;
  virtualization?: {
    memory_mib?: number | null;
    core_units?: number | null;
  } | null;
};

export type AcceleratorProductMetadata = {
  memory_total_mib?: number | null;
};

/**
 * AcceleratorGroup represents accelerator resources grouped by type.
 * It supports heterogeneous clusters where multiple accelerator types can coexist.
 */
export type AcceleratorGroup = {
  /**
   * Quantity is the total number of accelerators of this type.
   * Unit: count (e.g., 8.0 means 8 accelerators)
   */
  quantity: number;

  /**
   * ProductGroups contains accelerators further grouped by product model.
   * This enables fine-grained resource tracking for heterogeneous accelerator types.
   * Key: product model name (e.g., "Tesla-V100", "Tesla-T4", "MI100")
   * Value: number of accelerators of that product model
   */
  product_groups: Record<AcceleratorProduct, number> | null;

  /**
   * Products contains product-level accelerator resources. New code should prefer
   * this over product_groups because it can carry virtualization pools.
   */
  products?: Record<AcceleratorProduct, AcceleratorProductResources> | null;
};

/**
 * ResourceInfo represents a complete set of resources including CPU, Memory, and Accelerators.
 * All resources are organized in a flat structure for easy access and type safety.
 */
export type ResourceInfo = {
  /**
   * CPU represents the number of CPU cores.
   * Unit: cores (e.g., 96.0 means 96 CPU cores)
   */
  cpu: number;

  /**
   * Memory represents the amount of memory.
   * Unit: GiB (e.g., 512.0 means 512 GiB)
   */
  memory: number;

  /**
   * AcceleratorGroups contains accelerator resources grouped by type.
   * Key: accelerator type (e.g., "nvidia_gpu", "amd_gpu", "neuron")
   * Value: AcceleratorGroup containing details for that accelerator type
   */
  accelerator_groups: Record<AcceleratorType, AcceleratorGroup> | null;
};

/**
 * ResourceStatus represents a node's or cluster's resource status,
 * containing both allocatable and available resources.
 */
export type ResourceStatus = {
  /**
   * Allocatable represents the total resources that can be allocated.
   */
  allocatable: ResourceInfo | null;

  /**
   * Available represents the currently available (unallocated) resources.
   * Available = Allocatable - Allocated
   */
  available: ResourceInfo | null;
};

type DeviceResourcePool = {
  memory_mib: number;
  core_units: number;
};

export type DeviceResource = {
  uuid: string;
  order?: number | null;
  product: string;
  health: boolean;
  allocatable?: DeviceResourcePool | null;
  available?: DeviceResourcePool | null;
};

export type NodeResourceStatus = ResourceStatus & {
  devices?: DeviceResource[] | null;
};

/**
 * ClusterResourceInfo represents the complete resource information of a cluster,
 * organized by dimensions (Allocatable and Available).
 * This follows Kubernetes Node Status pattern for consistency and clarity.
 */
export type ClusterResourceInfo = ResourceStatus & {
  accelerator_metadata?: Record<
    AcceleratorType,
    { products?: Record<AcceleratorProduct, AcceleratorProductMetadata> | null }
  > | null;

  /**
   * NodeResources contains per-node resource information.
   * Key: node identifier (IP address for SSH clusters, node name for Kubernetes clusters).
   * Value: NodeResourceStatus for that node.
   */
  node_resources: Record<string, NodeResourceStatus> | null;
};

export type DeviceAllocation = {
  uuid: string;
  order?: number | null;
  product: string;
  memory_mib: number;
  core_units: number;
  node_id: string;
  /**
   * Physical resource pool for the allocated device. When present,
   * allocatable.memory_mib is the physical VRAM and available.memory_mib is
   * the remaining VRAM; actual usage is derived as allocatable - available.
   */
  allocatable?: DeviceResourcePool | null;
  available?: DeviceResourcePool | null;
};

export type ReplicaDeviceAllocation = {
  instance_id: string;
  replica_id?: string | null;
  node_id?: string | null;
  devices?: DeviceAllocation[] | null;
};

type ProductUsage = {
  memory_mib: number;
  core_units: number;
};

export type EndpointResourceSummary = {
  products?: Record<AcceleratorProduct, ProductUsage> | null;
};

export type EndpointResourceStatus = {
  replicas?: ReplicaDeviceAllocation[] | null;
  summary?: EndpointResourceSummary | null;
};
