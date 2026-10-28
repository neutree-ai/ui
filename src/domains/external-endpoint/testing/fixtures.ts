import type {
  ExternalEndpoint,
  ExternalEndpointSpec,
  ModelRoute,
  ModelRouteTarget,
  UpstreamSpec,
} from "../types";

export function makeUpstream(
  overrides: Partial<UpstreamSpec> = {},
): UpstreamSpec {
  return {
    name: "a",
    upstream: { url: "https://example.com" },
    model_mapping: {},
    models: null,
    ...overrides,
  };
}

/** A target in its saved shape, so a round trip through the form is equal. */
export function makeTarget(
  overrides: Partial<ModelRouteTarget> = {},
): ModelRouteTarget {
  return {
    upstream: "a",
    upstream_model: "old-model",
    priority: 0,
    weight: 1,
    ...overrides,
  };
}

export function makeRoute(overrides: Partial<ModelRoute> = {}): ModelRoute {
  return {
    model: "chat",
    strategy: "fixed",
    targets: [makeTarget()],
    ...overrides,
  };
}

export function makeExternalEndpoint(
  spec: Partial<ExternalEndpointSpec> = {},
): ExternalEndpoint {
  return {
    id: 1,
    api_version: "v1",
    kind: "ExternalEndpoint",
    metadata: {
      name: "review-only",
      workspace: "default",
      deletion_timestamp: null,
      creation_timestamp: "2026-01-01T00:00:00Z",
      update_timestamp: "2026-01-01T00:00:00Z",
      labels: {},
      annotations: {},
    },
    spec: {
      timeout: 60000,
      upstreams: [makeUpstream()],
      model_routes: [makeRoute()],
      ...spec,
    },
    status: null,
  };
}
