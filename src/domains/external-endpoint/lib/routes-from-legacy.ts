import type { ModelRoute, UpstreamSpec } from "../types";

/** An upstream's name, or `provider-N` by its position while unnamed. */
export function upstreamNameAt(upstream: UpstreamSpec, index: number) {
  return upstream.name || `provider-${index + 1}`;
}

export function routesFromLegacy(upstreams: UpstreamSpec[]): ModelRoute[] {
  const routes: ModelRoute[] = [];
  const seen = new Set<string>();
  for (const [index, upstream] of upstreams.entries()) {
    for (const [model, upstreamModel] of Object.entries(
      upstream.model_mapping ?? {},
    )) {
      if (seen.has(model)) continue;
      seen.add(model);
      routes.push({
        model,
        strategy: "fixed",
        targets: [
          {
            upstream: upstreamNameAt(upstream, index),
            upstream_model: upstreamModel,
            priority: 0,
            weight: 1,
          },
        ],
      });
    }
  }
  return routes;
}
