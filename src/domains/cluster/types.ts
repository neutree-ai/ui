import type { BaseStatus, Metadata } from "@/foundation/types/basic-types";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";

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

type AcceleratorVirtualizationSpec = {
  enabled?: boolean;
  config_patch?: Record<string, unknown> | null;
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
  cache?: ClusterCacheSpec;
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
  accelerator_virtualization?: AcceleratorVirtualizationSpec;
};

const NodeProvisionStatus = {
  PROVISIONING: "provisioning",
  PROVISIONED: "provisioned",
} as const;
type NodeProvisionStatus =
  (typeof NodeProvisionStatus)[keyof typeof NodeProvisionStatus];

export type ClusterStatus = BaseStatus<ClusterPhase> & {
  cache?: ClusterCacheStatus;
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
  component_status?: Record<string, unknown> | null;
};

enum ClusterPhase {
  PENDING = "Pending",
  INITIALIZING = "Initializing",
  RUNNING = "Running",
  UPDATING = "Updating",
  UPGRADING = "Upgrading",
  PAUSED = "Paused",
  FAILED = "Failed",
  DELETING = "Deleting",
  DELETED = "Deleted",
}

export type ZCacheSpec = {
  enabled: boolean;
  l1_size_gib: number;
  target_nodes: string[];
};
export type ZCacheStatus = {
  control_plane?: ZCacheControlPlaneStatus;
  observed_at?: string;
  observation_error?: string;
  current?: ZCacheSpec;
  configured_runtime_version?: string;
  runtime_endpoint?: { address: string; port: number };
  nodes?: {
    name: string;
    runtime: string;
    cache: string;
    capacity_bytes: number;
    reason?: string;
  }[];
  candidates?: { name: string; selectable: boolean; reason?: string }[];
  change?: {
    operation_id?: string;
    phase: string;
    message?: string;
    request?: {
      lmcache?: { l1SizeGb?: number; targetNodes?: string[] };
      operation?: { kind?: string };
    };
  };
  operations?: {
    id: string;
    phase: string;
    kind: string;
    created_at?: string;
    completed_at?: string;
    message?: string;
    nodes?: { name: string; phase: string; reason?: string }[];
  }[];
};

export type ZCacheControlPlaneStatus = {
  phase?: string;
  message?: string;
  ready: boolean;
  health_message?: string;
};

export type ClusterCacheSpec = {
  provider: string;
  options: Record<string, unknown>;
};
export type CacheCondition = {
  type: "ConfigurationApplied" | "Ready";
  status: "True" | "False" | "Unknown";
  reason: string;
  message?: string;
};
export type ClusterCacheStatus = {
  provider: string;
  phase: "Disabled" | "Reconciling" | "Ready" | "Unavailable" | "Failed";
  error_message?: string;
  conditions: CacheCondition[];
  details?: Record<string, unknown>;
};

export function zcacheSpec(
  cluster?: Pick<Cluster, "spec">,
): ZCacheSpec | undefined {
  return cluster?.spec.cache?.provider === "zcache"
    ? (cluster.spec.cache.options as ZCacheSpec)
    : undefined;
}

export function zcacheStatus(
  cluster?: Pick<Cluster, "status">,
): ZCacheStatus | undefined {
  return cluster?.status?.cache?.provider === "zcache"
    ? (cluster.status.cache.details as ZCacheStatus | undefined)
    : undefined;
}
