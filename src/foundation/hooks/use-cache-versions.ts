import { useCustom } from "@refinedev/core";
import type { CacheVersion } from "@/foundation/lib/cache-versions";

/** The cache runtime versions the platform can install, with their vLLM support. */
export function useCacheVersions(enabled = true) {
  return useCustom<CacheVersion[]>({
    url: "/rpc/zcache_versions",
    method: "get",
    queryOptions: { enabled, retry: false, staleTime: 5 * 60 * 1000 },
    errorNotification: false,
  });
}
