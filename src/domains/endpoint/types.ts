import type { BaseStatus, Metadata } from "@/foundation/types/basic-types";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";
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
  variables: Record<string, any> | null;
  env: Record<string, string> | null;
  // Recipe extension — filled in when the endpoint was created from a
  // Recipe MC. The frontend currently double-writes both these refs AND the
  // expanded model/resources/variables/env so existing backends keep working.
  model_catalog?: string;
  variant?: string;
  enabled_features?: string[];
};

export type EndpointStatus = BaseStatus<EndpointPhase> & {
  service_url: string | null;
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
  spec: { type: string };
  status: { resource_info?: ClusterResourceInfo | null } | null;
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
    features?: Record<
      string,
      {
        description?: string;
        default?: boolean;
        category?: string;
        engine_args?: Record<string, unknown> | null;
        env?: Record<string, string> | null;
        conflicts_with?: string[] | null;
      }
    > | null;
  };
};

/** Minimal model registry shape — only needs metadata.name */
export type EndpointModelRegistryRef = {
  metadata: Metadata;
};
