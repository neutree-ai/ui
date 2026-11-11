import {
  isPermissionDenied,
  translateApiError,
} from "@/foundation/lib/api-error-code";

/** Cluster cache admission errors → i18n keys. */
const CLUSTER_CACHE_ERROR_KEYS: Readonly<Record<string, string>> = {
  CLUSTER_CACHE_INVALID_OPTIONS: "clusters.zcache.errors.invalidOptions",
  CLUSTER_CACHE_INVALID_TARGET_NODE: "clusters.zcache.errors.invalidTargetNode",
  CLUSTER_CACHE_UNSUPPORTED_RUNTIME:
    "clusters.zcache.errors.unsupportedRuntime",
  CLUSTER_CACHE_USE_UPGRADE_ACTION: "clusters.zcache.errors.useUpgradeAction",
  CLUSTER_CACHE_VERSION_REQUIRED: "clusters.zcache.errors.versionRequired",
  CLUSTER_CACHE_INVALID_SPEC: "clusters.zcache.errors.invalidSpec",
  CLUSTER_CACHE_INVALID_TARGET_NODES:
    "clusters.zcache.errors.invalidTargetNodes",
  CLUSTER_CACHE_IN_USE: "clusters.zcache.errors.inUseByEndpoints",
};

/** Cluster cache upgrade API and RPC errors → i18n keys. */
const CACHE_UPGRADE_ERROR_KEYS: Readonly<Record<string, string>> = {
  "21001": "clusters.cacheUpgrade.errors.licenseRequired",
  CACHE_UPGRADE_INVALID_REQUEST: "clusters.cacheUpgrade.errors.invalidRequest",
  CACHE_UPGRADE_CLUSTER_PAUSED: "clusters.cacheUpgrade.errors.clusterPaused",
  CACHE_UPGRADE_IN_PROGRESS: "clusters.cacheUpgrade.errors.alreadyInProgress",
  CACHE_UPGRADE_CLUSTER_UNAVAILABLE:
    "clusters.cacheUpgrade.errors.clusterUnavailable",
  CACHE_UPGRADE_UNAVAILABLE: "clusters.cacheUpgrade.errors.cacheUnavailable",
  CACHE_UPGRADE_UNSUPPORTED_VERSION:
    "clusters.cacheUpgrade.errors.unsupportedVersion",
  CACHE_UPGRADE_INCOMPLETE_CHOICES:
    "clusters.cacheUpgrade.errors.incompleteChoices",
  CACHE_UPGRADE_INVALID_CHOICE: "clusters.cacheUpgrade.errors.invalidChoice",
  CACHE_UPGRADE_MISSING_ENGINE: "clusters.cacheUpgrade.errors.missingEngine",
  CACHE_UPGRADE_ENGINE_INCOMPATIBLE:
    "clusters.cacheUpgrade.errors.engineIncompatible",
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const clusterCacheErrorMessage = (
  t: Translate,
  error: unknown,
): string | undefined => translateApiError(t, error, CLUSTER_CACHE_ERROR_KEYS);

export const cacheUpgradeErrorMessage = (
  t: Translate,
  error: unknown,
): string | undefined => {
  const translated = translateApiError(t, error, CACHE_UPGRADE_ERROR_KEYS);
  if (translated) return translated;
  if (isPermissionDenied(error)) {
    return t("clusters.cacheUpgrade.errors.permissionDenied");
  }
  return undefined;
};
