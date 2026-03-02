import type { ExternalEndpointSpec } from "@/domains/external-endpoint/types";

export const ROUTE_TYPE_LABELS: Record<string, string> = {
  "/v1/chat/completions": "Chat Completions",
};

export function getExposedModels(spec: ExternalEndpointSpec | null): string[] {
  if (!spec?.upstreams) return [];
  const models: string[] = [];
  for (const upstream of spec.upstreams) {
    if (upstream.model_mapping) {
      models.push(...Object.keys(upstream.model_mapping));
    }
  }
  return models;
}
