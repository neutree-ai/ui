import type { BaseStatus, Metadata } from "./basic-types";

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

// Common configuration for all cluster types
export type CommonClusterConfig = {
  accelerator_type?: string | null;
  model_caches?: ModelCache[];
};

export type RaySSHProvisionClusterConfig = {
  provider: Provider;
  auth: Auth;
} & CommonClusterConfig;

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
} & CommonClusterConfig;

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
  config: RaySSHProvisionClusterConfig | KubernetesClusterConfig;
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
  resource_info?: any; // ClusterResources type - can be defined later if needed
  /**
   * Accelerator type (e.g. nvidia_gpu, amd_gpu)
   */
  accelerator_type?: string | null;
};

export enum ClusterPhase {
  PENDING = "Pending",
  RUNNING = "Running",
  FAILED = "Failed",
  DELETED = "Deleted",
}
