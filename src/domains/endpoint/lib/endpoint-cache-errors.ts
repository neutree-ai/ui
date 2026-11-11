import { translateApiError } from "@/foundation/lib/api-error-code";

/** Endpoint KV cache admission errors → i18n keys. */
const ENDPOINT_CACHE_ERROR_KEYS: Readonly<Record<string, string>> = {
  "21101": "endpoints.kvCacheSettings.errors.engineIncompatible",
  "21102": "endpoints.kvCacheSettings.errors.nodePoolNotReady",
  "21103": "endpoints.kvCacheSettings.errors.clusterDisabled",
  "21104": "endpoints.kvCacheSettings.errors.requiresVllm",
  "21105": "endpoints.kvCacheSettings.errors.requiresTextGeneration",
  "21106": "endpoints.kvCacheSettings.errors.invalidOptions",
  "21107": "endpoints.kvCacheSettings.errors.invalidTimeout",
  "21108": "endpoints.kvCacheSettings.errors.customOverride",
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const endpointCacheErrorMessage = (
  t: Translate,
  error: unknown,
): string | undefined => translateApiError(t, error, ENDPOINT_CACHE_ERROR_KEYS);
