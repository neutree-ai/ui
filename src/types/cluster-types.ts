import type { Metadata } from "./basic-types";

export type RayClusterConfig = {
  cluster_name: string;
  provider: Partial<{
    // 'local' | 'ssh' | 'gcp'
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
   * supported: 'local' | 'ssh' | 'gcp' | 'aws'
   */
  type: string;
  config: RayClusterConfig;
  image_registry: string;
};

export type ClusterStatus = {
  phase: ClusterPhase | null;
  image: string | null;
  dashboard_url: string | null;
  last_transition_time: string | null;
  error_message: string | null;
};

export enum ClusterPhase {
  PENDING = "Pending",
  RUNNING = "Running",
  FAILED = "Failed",
  DELETED = "Deleted",
}
