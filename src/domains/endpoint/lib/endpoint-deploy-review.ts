import { DEFAULT_KV_CACHE_TIMEOUT_SECONDS } from "@/domains/endpoint/lib/endpoint-deploy-kv-cache";
import type { Endpoint } from "@/domains/endpoint/types";

const MISSING = "—";

/** The replica count the form deploys: one when unset. */
export const endpointReplicaCount = (values: Endpoint) =>
  values.spec.replicas?.num ?? 1;

/** Whether the form has a model to estimate weights for. */
export const endpointHasModel = (values: Endpoint) =>
  Boolean(values.spec.model?.name);

/**
 * The review step's one-line summary values. Empty identities show a dash;
 * empty resources show zero; the cache timeout is null while the cache is off.
 */
export function endpointReviewSummary(values: Endpoint) {
  const { model, cluster, resources, engine, kv_cache } = values.spec;
  return {
    model: model?.name || MISSING,
    resources: {
      cluster: cluster || MISSING,
      count: endpointReplicaCount(values),
      cpu: resources?.cpu ?? 0,
      memory: resources?.memory ?? 0,
      gpu: resources?.gpu ?? 0,
    },
    engine: {
      engine: engine?.engine || MISSING,
      version: engine?.version || MISSING,
    },
    cacheTimeout: kv_cache
      ? (kv_cache.options?.timeout_seconds ?? DEFAULT_KV_CACHE_TIMEOUT_SECONDS)
      : null,
  };
}
