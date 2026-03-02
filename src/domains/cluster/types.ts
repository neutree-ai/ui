import type { BaseStatus, Metadata } from "@/foundation/types/basic-types";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";

export type { ResourceStatus } from "@/foundation/types/resource-types";

type Provider = {
  type: string;
  head_ip: string;
  worker_ips: string[];
  coordinator_address?: string;
  region?: string;
  availability_zone?: string;
  project_id?: string;
};

type Auth = {
  ssh_user?: string;
  ssh_private_key?: string;
};

type RaySSHProvisionClusterConfig = {
  provider: Provider;
  auth: Auth;
};

enum KubernetesAccessMode {
  LoadBalancer = "LoadBalancer",
  NodePort = "NodePort",
  Ingress = "Ingress",
}

type RouterSpec = {
  version?: string;
  access_mode?: KubernetesAccessMode;
  replicas?: number;
  resources?: Record<string, string>;
};

type KubernetesClusterConfig = {
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

const NodeProvisionStatus = {
  PROVISIONING: "provisioning",
  PROVISIONED: "provisioned",
} as const;
type NodeProvisionStatus =
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
  resource_info?: ClusterResourceInfo | null;
  /**
   * Accelerator type (e.g. nvidia_gpu, amd_gpu)
   */
  accelerator_type?: string | null;
};

enum ClusterPhase {
  PENDING = "Pending",
  RUNNING = "Running",
  PAUSED = "Paused",
  FAILED = "Failed",
  DELETED = "Deleted",
}
