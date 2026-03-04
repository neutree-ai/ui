import type { BaseStatus, Metadata } from "@/foundation/types/basic-types";

type ExternalEndpointPhase = "Pending" | "Running" | "Failed" | "Deleted";

export type AuthSpec = {
  type: string;
  credential?: string;
};

export type UpstreamSpec = {
  upstream?: { url: string } | null;
  auth?: AuthSpec | null;
  endpoint_ref?: string;
  model_mapping: Record<string, string>;
  models: string[] | null;
};

export type ExternalEndpointSpec = {
  route_type?: string;
  timeout: number | null;
  upstreams: UpstreamSpec[];
};

export type ExternalEndpointStatus = BaseStatus<ExternalEndpointPhase> & {
  service_url: string | null;
};

export type ExternalEndpoint = {
  id: number;
  api_version: "v1";
  kind: "ExternalEndpoint";
  metadata: Metadata;
  spec: ExternalEndpointSpec;
  status: ExternalEndpointStatus | null;
};
