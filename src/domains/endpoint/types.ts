import type { RecipeFeature } from "@/foundation/recipe/types";
import type { BaseStatus, Metadata } from "@/foundation/types/basic-types";
import type {
  ClusterResourceInfo,
  EndpointResourceStatus,
} from "@/foundation/types/resource-types";
import type {
  DeploymentOptions,
  EndpointEngineSpec,
  ModelSpec,
  ReplicaSpec,
  ResourceSpec,
} from "@/foundation/types/serving-types";

export type {
  DeploymentOptions,
  EndpointEngineSpec,
  ModelSpec,
  ReplicaSpec,
  ResourceSpec,
} from "@/foundation/types/serving-types";

enum EndpointPhase {
  PENDING = "Pending",
  DEPLOYING = "Deploying",
  MODELDOWNLOADING = "ModelDownloading",
  RUNNING = "Running",
  PAUSED = "Paused",
  DELETING = "Deleting",
  FAILED = "Failed",
  DELETED = "Deleted",
}

export type EndpointSpec = {
  cluster: string;
  model: ModelSpec;
  engine: EndpointEngineSpec;
  resources: ResourceSpec | null;
  replicas: ReplicaSpec | null;
  deployment_options: DeploymentOptions | null;
  variables: Record<string, unknown> | null;
  env: Record<string, string> | null;
};

export type EndpointStatus = BaseStatus<EndpointPhase> & {
  service_url: string | null;
  resources?: EndpointResourceStatus | null;
  model_download_completed_hash?: string | null;
};

export type Endpoint = {
  id: number;
  api_version: "v1";
  kind: "Endpoint";
  metadata: Metadata;
  spec: EndpointSpec;
  status: EndpointStatus | null;
};

// ---------------------------------------------------------------------------
// Minimal cross-domain ref types used by endpoint form hook.
// These keep the endpoint domain free of direct imports from cluster/engine/etc.
// ---------------------------------------------------------------------------

/** Minimal cluster shape needed by endpoint form */
export type EndpointClusterRef = {
  metadata: Metadata;
  spec: {
    type: string;
    accelerator_virtualization?: { enabled?: boolean } | null;
  };
  status: {
    ready_nodes?: number;
    desired_nodes?: number;
    resource_info?: ClusterResourceInfo | null;
    /**
     * The virtualization resource keys the cluster's accelerator virtualization
     * mode supports (e.g. ["virtualization.memory_mib", "virtualization.core_percent"]).
     * Mirrors the backend AcceleratorVirtualizationStatus.supported_resources;
     * the UI gates virtualization inputs on this list only.
     */
    accelerator_virtualization?: {
      supported_resources?: string[];
    } | null;
  } | null;
};

/** Minimal engine shape needed by endpoint form */
export type EndpointEngineRef = {
  metadata: Metadata;
  spec: {
    versions: EndpointEngineVersionRef[];
    supported_tasks: string[];
  };
};

export type EndpointEngineVersionRef = {
  version: string;
  values_schema?: Record<string, unknown>;
};

/** Minimal model catalog shape needed by endpoint form */
export type EndpointModelCatalogRef = {
  id: number;
  metadata: Metadata;
  spec: {
    model: ModelSpec;
    engine: EndpointEngineSpec;
    resources: ResourceSpec | null;
    replicas: ReplicaSpec | null;
    deployment_options: DeploymentOptions | null;
    variables: Record<string, unknown> | null;
    env?: Record<string, string> | null;
    // Recipe extension — present on Recipe MCs.
    base?: {
      engine_args?: Record<string, unknown> | null;
      env?: Record<string, string> | null;
    } | null;
    variants?: Record<
      string,
      {
        model?: ModelSpec | null;
        resources?: ResourceSpec | null;
        engine_args?: Record<string, unknown> | null;
        env?: Record<string, string> | null;
        description?: string;
        vram_minimum_gb?: number | null;
      }
    > | null;
    features?: RecipeFeature[] | null;
  };
};

/** Minimal model registry shape — only needs metadata.name */
export type EndpointModelRegistryRef = {
  metadata: Metadata;
};
