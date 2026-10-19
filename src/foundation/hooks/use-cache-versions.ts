import { useCustom } from "@refinedev/core";

type CacheVersion = { version: string; engine_versions: string[] };

export function useCacheVersions(enabled = true) {
  return useCustom<CacheVersion[]>({
    url: "/rpc/zcache_versions",
    method: "get",
    queryOptions: { enabled, retry: false },
    errorNotification: false,
  });
}
