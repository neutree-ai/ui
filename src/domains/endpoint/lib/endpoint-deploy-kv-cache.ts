import type { UseFormReturn } from "react-hook-form";
import { endpointZCacheOptions } from "@/domains/endpoint/lib/zcache";
import type { Endpoint, EndpointClusterRef } from "@/domains/endpoint/types";

/** The ZCache timeout an enabled cache gets when none is set. */
export const DEFAULT_KV_CACHE_TIMEOUT_SECONDS = 5;

const KV_CACHE = "spec.kv_cache";
const KV_CACHE_TIMEOUT = "spec.kv_cache.options.timeout_seconds";

/**
 * Whether the cache runtime's supported engine versions are worth fetching:
 * the platform offers ZCache and the cluster is Kubernetes with ZCache on.
 */
export const checksZCacheRuntime = (
  hasZCache: boolean,
  cluster?: EndpointClusterRef,
) =>
  hasZCache &&
  cluster?.spec.type === "kubernetes" &&
  endpointZCacheOptions(cluster)?.enabled === true;

/**
 * Turns the ZCache switch on or off: on keeps the timeout typed so far (or
 * the default), off clears the whole cache to null.
 */
export function setEndpointKvCacheEnabled(
  form: UseFormReturn,
  enabled: boolean,
) {
  form.setValue(
    KV_CACHE,
    enabled
      ? {
          provider: "zcache",
          options: {
            timeout_seconds:
              form.getValues(KV_CACHE_TIMEOUT) ??
              DEFAULT_KV_CACHE_TIMEOUT_SECONDS,
          },
        }
      : null,
    { shouldDirty: true, shouldValidate: true },
  );
}

/**
 * The cache configuration dialog's values: the timeout in effect and the
 * selected cluster's name (null when none is selected).
 */
export function endpointKvCacheConfig(
  form: UseFormReturn,
  cache: Endpoint["spec"]["kv_cache"],
  cluster?: EndpointClusterRef,
) {
  return {
    timeoutSeconds:
      cache?.options?.timeout_seconds ??
      form.getValues(KV_CACHE_TIMEOUT) ??
      DEFAULT_KV_CACHE_TIMEOUT_SECONDS,
    cluster: cluster?.metadata.name ?? null,
  };
}
