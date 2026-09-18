import type { ExternalEndpointSpec, UpstreamSpec } from "../types";

export function getUpstreamModelMappings(
  spec: ExternalEndpointSpec,
  upstream: UpstreamSpec,
): { upstreamModel: string; exposedModels: string[] }[] {
  const groups = new Map<string, Set<string>>();
  const add = (source: string, exposed: string) => {
    if (!groups.has(source)) groups.set(source, new Set());
    groups.get(source)?.add(exposed);
  };

  if (spec.model_routes?.length) {
    for (const route of spec.model_routes) {
      for (const target of route.targets) {
        if (upstream.name && target.upstream === upstream.name) {
          add(target.upstream_model, route.model);
        }
      }
    }
  } else {
    for (const [exposed, source] of Object.entries(
      upstream.model_mapping ?? {},
    )) {
      add(source, exposed);
    }
  }

  return Array.from(groups, ([upstreamModel, models]) => ({
    upstreamModel,
    exposedModels: [...models],
  }));
}
