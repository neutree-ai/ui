import {
  isPermissionDenied,
  translateApiError,
} from "@/foundation/lib/api-error-code";

/** Cluster cache admission errors → i18n keys. */
const CLUSTER_CACHE_ERROR_KEYS: Readonly<Record<string, string>> = {
  "21110": "clusters.zcache.errors.invalidOptions",
  "21111": "clusters.zcache.errors.invalidTargetNode",
  "21112": "clusters.zcache.errors.unsupportedRuntime",
  "21113": "clusters.zcache.errors.useUpgradeAction",
  "21114": "clusters.zcache.errors.versionRequired",
  "21115": "clusters.zcache.errors.invalidSpec",
  "21116": "clusters.zcache.errors.invalidTargetNodes",
  "21117": "clusters.zcache.errors.inUseByEndpoints",
};

/** Cluster cache upgrade API and RPC errors → i18n keys. */
const CACHE_UPGRADE_ERROR_KEYS: Readonly<Record<string, string>> = {
  "21001": "clusters.cacheUpgrade.errors.licenseRequired",
  "21121": "clusters.cacheUpgrade.errors.invalidRequest",
  "21122": "clusters.cacheUpgrade.errors.clusterPaused",
  "21123": "clusters.cacheUpgrade.errors.alreadyInProgress",
  "21124": "clusters.cacheUpgrade.errors.clusterUnavailable",
  "21125": "clusters.cacheUpgrade.errors.cacheUnavailable",
  "21126": "clusters.cacheUpgrade.errors.unsupportedVersion",
  "21127": "clusters.cacheUpgrade.errors.incompleteChoices",
  "21128": "clusters.cacheUpgrade.errors.invalidChoice",
  "21129": "clusters.cacheUpgrade.errors.missingEngine",
  "21130": "clusters.cacheUpgrade.errors.engineIncompatible",
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
