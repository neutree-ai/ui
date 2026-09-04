import type { BaseStatus, Metadata } from "@/foundation/types/basic-types";

type ExternalEndpointPhase =
  | "Pending"
  | "Running"
  | "Degraded"
  | "Failed"
  | "Deleted";

export type UpstreamStatusPhase = "Ready" | "Failed";

export type AuthSpec = {
  type: string;
  credential?: string;
};

export type UpstreamSpec = {
  name?: string;
  upstream?: { url: string } | null;
  auth?: AuthSpec | null;
  endpoint_ref?: string;
  model_mapping: Record<string, string>;
  models: string[] | null;
};

export type ModelRouteTarget = {
  upstream: string;
  upstream_model: string;
  priority?: number;
  weight?: number;
  max_inflight_requests?: number;
};

export type ModelRoute = {
  model: string;
  strategy?: string;
  targets: ModelRouteTarget[];
};

export type ExternalEndpointSpec = {
  route_type?: string;
  timeout: number | null;
  upstreams: UpstreamSpec[];
  model_routes?: ModelRoute[];
};

/**
 * Per-upstream resolution result. The API emits one entry per spec upstream,
 * in spec order; `ref` is the internal endpoint name or the upstream URL and
 * never carries the auth credential.
 */
export type UpstreamStatus = {
  kind?: "endpoint_ref" | "external";
  ref?: string;
  models?: string[] | null;
  phase?: UpstreamStatusPhase;
  error_message?: string | null;
};

export type ExternalEndpointStatus = BaseStatus<ExternalEndpointPhase> & {
  service_url: string | null;
  upstream_status?: UpstreamStatus[] | null;
};

export type ExternalEndpoint = {
  id: number;
  api_version: "v1";
  kind: "ExternalEndpoint";
  metadata: Metadata;
  spec: ExternalEndpointSpec;
  status: ExternalEndpointStatus | null;
};
