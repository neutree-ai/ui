import type { ExternalEndpointSpec } from "@/domains/external-endpoint/types";

export function getExposedModels(spec: ExternalEndpointSpec | null): string[] {
  if (!spec?.upstreams) return [];
  if (spec.model_routes?.length) {
    return spec.model_routes.map((route) => route.model).filter(Boolean);
  }
  const models: string[] = [];
  for (const upstream of spec.upstreams) {
    if (upstream.model_mapping) {
      models.push(...Object.keys(upstream.model_mapping));
    }
  }
  return models;
}
