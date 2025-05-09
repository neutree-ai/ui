import type { Metadata } from "./basic-types";

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
  Ingress = "Ingress",
}

export type HeadNodeSpec = {
  access_mode?: KubernetesAccessMode;
  resources?: Record<string, string>;
};

export type WorkerGroupSpec = {
  group_name?: string;
  min_replicas?: number;
  max_replicas?: number;
  resources?: Record<string, string>;
};

export type RayKubernetesProvisionClusterConfig = {
  kubeconfig?: string;
  head_node_spec?: HeadNodeSpec;
  worker_group_specs?: WorkerGroupSpec[];
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
  config: RaySSHProvisionClusterConfig | RayKubernetesProvisionClusterConfig;
  image_registry: string;
  /**
   * The neutree serving version, if not specified, the default version will be used
   */
  version?: string;
};

export const NodeProvisionStatus = {
  PROVISIONING: "provisioning",
  PROVISIONED: "provisioned",
} as const;
export type NodeProvisionStatus =
  (typeof NodeProvisionStatus)[keyof typeof NodeProvisionStatus];

export type ClusterStatus = {
  phase: ClusterPhase | null;
  image: string | null;
  dashboard_url: string | null;
  last_transition_time: string | null;
  error_message: string | null;
  /**
   * The number of ready nodes in the cluster
   */
  ready_nodes?: number;
  /**
   * The desired number of nodes in the cluster
   */
  desired_nodes?: number;
  /**
   * The current neutree serving version
   */
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
};

export enum ClusterPhase {
  PENDING = "Pending",
  RUNNING = "Running",
  FAILED = "Failed",
  DELETED = "Deleted",
}
