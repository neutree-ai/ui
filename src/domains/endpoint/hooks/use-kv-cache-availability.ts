import {
  type EndpointCacheManagerStatus,
  readEndpointCacheManagerStatus,
} from "@/domains/endpoint/lib/cache-manager-status";
import {
  endpointZCacheOptions,
  kvCacheUnavailableReason,
} from "@/domains/endpoint/lib/zcache";
import type { EndpointClusterRef } from "@/domains/endpoint/types";
import { useCacheVersions } from "@/foundation/hooks/use-cache-versions";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import { engineVersionsFor } from "@/foundation/lib/cache-versions";

export type KvCacheAvailability = {
  /** Whether the platform offers ZCache at all. */
  hasZCache: boolean;
  cacheManager: EndpointCacheManagerStatus;
  /** Translation key explaining why ZCache cannot be enabled, or null. */
  unavailableReason: string | null;
};

/**
 * Whether ZCache can serve an endpoint with the given placement and runtime.
 * Runtime versions are only fetched for a Kubernetes cluster with ZCache on.
 */
export function useKvCacheAvailability({
  cluster,
  acceleratorType,
  engine,
  task,
  cacheStatusLoading = false,
}: {
  cluster?: EndpointClusterRef;
  acceleratorType?: string | null;
  engine?: { engine?: string; version?: string };
  task?: string;
  cacheStatusLoading?: boolean;
}): KvCacheAvailability {
  const { systemInfo } = useSystemApi();
  const hasZCache =
    systemInfo?.capabilities?.cluster_cache_providers?.includes("zcache") ===
    true;
  const zcacheOptions = endpointZCacheOptions(cluster);
  const versions = useCacheVersions(
    hasZCache &&
      cluster?.spec.type === "kubernetes" &&
      zcacheOptions?.enabled === true,
  );
  const cacheManager = readEndpointCacheManagerStatus(
    cluster,
    cacheStatusLoading,
  );
  const unavailableReason = kvCacheUnavailableReason({
    cluster,
    acceleratorType,
    engine,
    task,
    manager: cacheManager,
    versions: {
      isLoading: versions.isLoading,
      isError: versions.isError,
      engineVersions: engineVersionsFor(
        versions.data?.data,
        zcacheOptions?.version,
      ),
    },
  });
  return { hasZCache, cacheManager, unavailableReason };
}
