import type { ExternalEndpointSpec } from "@/domains/external-endpoint/types";

export function getExposedModels(spec: ExternalEndpointSpec | null): string[] {
  if (!spec?.upstreams) return [];
  if (spec.model_routes?.length) {
    return [...new Set(spec.model_routes.map((route) => route.model))];
  }
  const models: string[] = [];
  const seen = new Set<string>();
  for (const upstream of spec.upstreams) {
    if (upstream.model_mapping) {
      for (const model of Object.keys(upstream.model_mapping)) {
        if (!seen.has(model)) {
          seen.add(model);
          models.push(model);
        }
      }
    }
  }
  return models;
}
