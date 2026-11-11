import { translateApiError } from "@/foundation/lib/api-error-code";

/** Endpoint KV cache admission errors → i18n keys. */
const ENDPOINT_CACHE_ERROR_KEYS: Readonly<Record<string, string>> = {
  ENDPOINT_CACHE_ENGINE_INCOMPATIBLE:
    "endpoints.kvCacheSettings.errors.engineIncompatible",
  ENDPOINT_CACHE_NODE_POOL_NOT_READY:
    "endpoints.kvCacheSettings.errors.nodePoolNotReady",
  ENDPOINT_CACHE_CLUSTER_DISABLED:
    "endpoints.kvCacheSettings.errors.clusterDisabled",
  ENDPOINT_CACHE_REQUIRES_VLLM: "endpoints.kvCacheSettings.errors.requiresVllm",
  ENDPOINT_CACHE_REQUIRES_TEXT_GENERATION:
    "endpoints.kvCacheSettings.errors.requiresTextGeneration",
  ENDPOINT_CACHE_INVALID_OPTIONS:
    "endpoints.kvCacheSettings.errors.invalidOptions",
  ENDPOINT_CACHE_INVALID_TIMEOUT:
    "endpoints.kvCacheSettings.errors.invalidTimeout",
  ENDPOINT_CACHE_CUSTOM_OVERRIDE:
    "endpoints.kvCacheSettings.errors.customOverride",
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const endpointCacheErrorMessage = (
  t: Translate,
  error: unknown,
): string | undefined => translateApiError(t, error, ENDPOINT_CACHE_ERROR_KEYS);
