import type { Endpoint } from "@/domains/endpoint/types";
import {
  kvCacheTimeoutSeconds,
  replicaCount,
} from "./endpoint-display-summary";

const MISSING = "—";

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
      count: replicaCount(values.spec.replicas),
      cpu: resources?.cpu ?? 0,
      memory: resources?.memory ?? 0,
      gpu: resources?.gpu ?? 0,
    },
    engine: {
      engine: engine?.engine || MISSING,
      version: engine?.version || MISSING,
    },
    cacheTimeout: kv_cache ? kvCacheTimeoutSeconds(kv_cache) : null,
  };
}
