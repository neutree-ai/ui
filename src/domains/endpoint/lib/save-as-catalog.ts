import type { Endpoint } from "@/domains/endpoint/types";

/**
 * The model catalog an endpoint's current configuration would be saved as.
 *
 * The result is a flat catalog: no variants, no features, and no link back to
 * the catalog the endpoint was deployed from. An endpoint holds the *composed*
 * result of whatever recipe produced it, and nothing in it says which layer —
 * base, variant or feature — any one engine arg came from, so a saved catalog
 * can only state the result. Trying to write those args back into their
 * original layers is what this deliberately does not do.
 *
 * Two fields are dropped rather than carried:
 *
 *   - `cluster` — a catalog has no such field; where to deploy is chosen per
 *     deployment.
 *   - `replicas` — deployment scale is not part of the template. It also keeps
 *     a paused endpoint, whose replica count is 0 while the real number waits
 *     in a label, from saving a catalog that deploys nothing.
 *
 * Labels are not inherited either: an endpoint's carry runtime bookkeeping
 * (the paused replica count among them) that means nothing on a catalog.
 */
export function buildCatalogFromEndpoint(
  endpoint: Endpoint,
  name: string,
): Record<string, unknown> {
  const spec = endpoint.spec;

  return {
    api_version: "v1",
    kind: "ModelCatalog",
    metadata: {
      name,
      workspace: endpoint.metadata.workspace,
      labels: {},
    },
    spec: {
      model: spec.model ?? null,
      engine: spec.engine ?? null,
      resources: spec.resources ?? null,
      deployment_options: spec.deployment_options ?? null,
      variables: spec.variables ?? null,
      env: spec.env ?? null,
    },
  };
}
