import type { BaseStatus, Metadata } from "./basic-types";

// ============================================================================
// Cluster Resource Information Types
// These types are used for cluster-level resource tracking and reporting.
// They follow Kubernetes Node Status pattern for organizing resources by dimensions.
// ============================================================================

/**
 * AcceleratorType represents the type of accelerator (e.g., "nvidia_gpu", "amd_gpu", "neuron")
 */
export type AcceleratorType = string;

/**
 * AcceleratorProduct represents the product model name (e.g., "Tesla-V100", "Tesla-T4", "MI100")
 */
export type AcceleratorProduct = string;

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

/**
 * ClusterResources represents the complete resource information of a cluster,
 * organized by dimensions (Allocatable and Available).
 * This follows Kubernetes Node Status pattern for consistency and clarity.
 */
export type ClusterResources = ResourceStatus & {
  /**
   * NodeResources contains per-node resource information.
   * Key: node identifier (IP address for SSH clusters, node name for Kubernetes clusters).
   * Value: ResourceStatus for that node.
   */
  node_resources: Record<string, ResourceStatus> | null;
};

export type RayClusterConfig = {
  cluster_name: string;
  provider: Partial<{
    type: string;
    head_ip: string;
    worker_ips: string[];
    coordinator_address: string;
    // cloud
    region?: string;
    availability_zone?: string;
    project_id?: string;
  }>;
  auth: Partial<{
    ssh_user: string;
    ssh_private_key: string;
  }>;
  docker: Partial<{
    image: string;
    container_name: string;
    run_options?: string[];
    head_run_options?: string[];
    worker_run_options?: string[];
    pull_before_run: boolean;
  }>;
  head_start_ray_commands?: string[];
  worker_start_ray_commands?: string[];
  head_setup_commands?: string[];
  worker_setup_commands?: string[];
  // scaling
  min_workers?: number;
  max_workers?: number;
  upscaling_speed?: number;
  idle_timeout_minutes?: number;
  available_node_types?: any;
  head_node_type?: string;
};

export type Provider = {
  type: string;
  head_ip: string;
  worker_ips: string[];
  coordinator_address?: string;
  region?: string;
  availability_zone?: string;
  project_id?: string;
};

export type Auth = {
  ssh_user?: string;
  ssh_private_key?: string;
};

export type RaySSHProvisionClusterConfig = {
  provider: Provider;
  auth: Auth;
};

export enum KubernetesAccessMode {
  LoadBalancer = "LoadBalancer",
  NodePort = "NodePort",
  Ingress = "Ingress",
}

export type RouterSpec = {
  version?: string;
  access_mode?: KubernetesAccessMode;
  replicas?: number;
  resources?: Record<string, string>;
};

export type KubernetesClusterConfig = {
  kubeconfig?: string;
  router?: RouterSpec;
};

// ClusterConfig is the unified configuration for all cluster types
export type ClusterConfig = {
  ssh_config?: RaySSHProvisionClusterConfig;
  kubernetes_config?: KubernetesClusterConfig;
  accelerator_type?: string | null;
  model_caches?: ModelCache[];
};

export type ModelCache = {
  name?: string;
  host_path?: {
    path: string;
    type?: string;
  };
  nfs?: {
    server: string;
    path: string;
    readOnly?: boolean;
  };
  pvc?: {
    // PersistentVolumeClaimSpec fields
    accessModes?: string[];
    resources?: {
      requests?: {
        storage?: string;
      };
    };
    storageClassName?: string;
    volumeMode?: string;
    volumeName?: string;
  };
};

export type Cluster = {
  id: number;
  api_version: "v1";
  kind: "Cluster";
  metadata: Metadata;
  spec: ClusterSpec;
  status: ClusterStatus | null;
};

export type ClusterSpec = {
  /**
   * The type of the cluster.
   * supported: 'ssh' | 'kubernetes'
   */
  type: string;
  config: ClusterConfig;
  image_registry: string;
  /**
   * The cluster image version.
   */
  version?: string;
};

export const NodeProvisionStatus = {
  PROVISIONING: "provisioning",
  PROVISIONED: "provisioned",
} as const;
export type NodeProvisionStatus =
  (typeof NodeProvisionStatus)[keyof typeof NodeProvisionStatus];

export type ClusterStatus = BaseStatus<ClusterPhase> & {
  image: string | null;
  dashboard_url: string | null;
  /**
   * The number of ready nodes in the cluster
   */
  ready_nodes?: number;
  /**
   * The desired number of nodes in the cluster
   */
  desired_nodes?: number;
  version?: string;
  /**
   * Ray version
   */
  ray_version?: string;
  /**
   * Whether the cluster is initialized
   */
  initialized?: boolean;
  /**
   * The cluster all node provision status
   */
  node_provision_status?: NodeProvisionStatus;
  /**
   * Cluster resource information
   */
  resource_info?: ClusterResources | null;
  /**
   * Accelerator type (e.g. nvidia_gpu, amd_gpu)
   */
  accelerator_type?: string | null;
};

export enum ClusterPhase {
  PENDING = "Pending",
  RUNNING = "Running",
  PAUSED = "Paused",
  FAILED = "Failed",
  DELETED = "Deleted",
}
