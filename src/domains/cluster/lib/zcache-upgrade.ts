import { type Cluster, type ZCacheStatus, zcacheStatus } from "../types";

export const RESOURCE_SPEC_SIGNATURE = "neutree.ai/resource-spec-signature";
const CACHE_UPGRADE_REQUEST = "neutree.ai/cache-upgrade";

/** An endpoint on the cluster that reads from its cache, as the upgrade dialog needs it. */
export type CacheDependentEndpoint = {
  id: number;
  metadata: {
    name: string;
    display_name?: string;
    annotations?: Record<string, string>;
  };
  spec: {
    engine: { engine: string; version: string };
    kv_cache?: { provider: string };
    replicas?: { num: number };
  };
};

/**
 * The upgrade to show for the cluster. A request the controller has not
 * picked up yet stands in for the last reported upgrade, so a previous
 * success is not shown while the new request waits for reconciliation.
 */
export function effectiveUpgrade(
  cluster: Cluster,
): ZCacheStatus["upgrade"] | undefined {
  const reported = zcacheStatus(cluster)?.upgrade;
  let requestedId: string | undefined;
  try {
    requestedId = JSON.parse(
      cluster.metadata.annotations?.[CACHE_UPGRADE_REQUEST] ?? "{}",
    ).id;
  } catch {
    // Malformed external annotations do not hide the last observed status.
  }
  return requestedId && requestedId !== reported?.id
    ? { id: requestedId, phase: "UpdatingRuntime", endpoints: [] }
    : reported;
}

export function upgradeInProgress(upgrade?: ZCacheStatus["upgrade"]) {
  return !!upgrade && !["Succeeded", "Failed"].includes(upgrade.phase);
}

/**
 * What to do with an endpoint when the cache runtime moves to a version
 * supporting `supported` engine versions: "keep" its engine, move to an
 * engine version, or "disable" its cache. "" means the user must choose.
 */
type UpgradeAction = string;

export function defaultUpgradeAction(
  engineVersion: string,
  supported: string[],
): UpgradeAction {
  return supported.includes(engineVersion) ? "keep" : "";
}

/** Engine versions an endpoint can move to: supported, installed, and not its own. */
export function upgradeEngineTargets(
  engineVersion: string,
  supported: string[],
  installed: string[],
) {
  return supported.filter((v) => installed.includes(v) && v !== engineVersion);
}

export function upgradeEndpointPayload(
  endpoint: CacheDependentEndpoint,
  action: UpgradeAction,
) {
  return {
    name: endpoint.metadata.name,
    expected_signature:
      endpoint.metadata.annotations?.[RESOURCE_SPEC_SIGNATURE],
    disable_cache: action === "disable",
    engine_version: action === "keep" || action === "disable" ? "" : action,
  };
}
