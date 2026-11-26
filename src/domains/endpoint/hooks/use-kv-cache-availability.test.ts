import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { EndpointClusterRef } from "@/domains/endpoint/types";
import { useCacheVersions } from "@/foundation/cache-version/use-cache-versions";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import { useKvCacheAvailability } from "./use-kv-cache-availability";

vi.mock("@/foundation/hooks/use-system-api", () => ({ useSystemApi: vi.fn() }));
vi.mock("@/foundation/cache-version/use-cache-versions", () => ({
  useCacheVersions: vi.fn(() => ({ isLoading: false, isError: false })),
}));

it("fetches runtime versions for a ZCache cluster on a ZCache platform", () => {
  vi.mocked(useSystemApi).mockReturnValue({
    systemInfo: { capabilities: { cluster_cache_providers: ["zcache"] } },
  } as unknown as ReturnType<typeof useSystemApi>);
  const cluster = {
    metadata: { name: "test" },
    spec: {
      type: "kubernetes",
      cache: { provider: "zcache", options: { enabled: true } },
    },
  } as unknown as EndpointClusterRef;
  renderHook(() => useKvCacheAvailability({ cluster }));
  expect(vi.mocked(useCacheVersions)).toHaveBeenLastCalledWith(true);
});
