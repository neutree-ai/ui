import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { EndpointClusterRef } from "@/domains/endpoint/types";
import { useCacheVersions } from "@/foundation/hooks/use-cache-versions";
import { useSystemApi } from "@/foundation/hooks/use-system-api";
import { useKvCacheAvailability } from "./use-kv-cache-availability";

vi.mock("@/foundation/hooks/use-system-api", () => ({ useSystemApi: vi.fn() }));
vi.mock("@/foundation/hooks/use-cache-versions", () => ({
  useCacheVersions: vi.fn(() => ({ isLoading: false, isError: false })),
}));

const cluster = (type: string, enabled: boolean) =>
  ({
    metadata: { name: "test" },
    spec: { type, cache: { provider: "zcache", options: { enabled } } },
  }) as unknown as EndpointClusterRef;

it.each([
  {
    name: "a ZCache cluster",
    providers: ["zcache"],
    target: cluster("kubernetes", true),
    fetch: true,
  },
  {
    name: "a cluster without ZCache",
    providers: ["zcache"],
    target: cluster("kubernetes", false),
    fetch: false,
  },
  {
    name: "an SSH cluster",
    providers: ["zcache"],
    target: cluster("ssh", true),
    fetch: false,
  },
  {
    name: "no cluster",
    providers: ["zcache"],
    target: undefined,
    fetch: false,
  },
  {
    name: "a platform without ZCache",
    providers: [],
    target: cluster("kubernetes", true),
    fetch: false,
  },
])(
  "fetches runtime versions for $name: $fetch",
  ({ providers, target, fetch }) => {
    vi.mocked(useSystemApi).mockReturnValue({
      systemInfo: { capabilities: { cluster_cache_providers: providers } },
    } as unknown as ReturnType<typeof useSystemApi>);
    renderHook(() => useKvCacheAvailability({ cluster: target }));
    expect(vi.mocked(useCacheVersions)).toHaveBeenLastCalledWith(fetch);
  },
);
