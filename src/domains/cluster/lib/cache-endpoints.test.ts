import { describe, expect, it } from "vitest";
import {
  type CacheEndpointCandidate,
  cacheEndpointRefs,
} from "./cache-endpoints";

const endpoint = (
  id: number,
  overrides: Partial<CacheEndpointCandidate> = {},
): CacheEndpointCandidate => ({
  id,
  metadata: { name: `ep-${id}` },
  spec: { kv_cache: { provider: "zcache" } },
  ...overrides,
});

const observed = (inUse: boolean, nodes: string[] = []) => ({
  phase: "Running",
  kv_cache: { provider: "zcache", details: { in_use: inUse } },
  resources: {
    replicas: nodes.map((node_id, index) => ({
      instance_id: `r-${index}`,
      node_id,
    })),
  },
});

describe("cacheEndpointRefs", () => {
  it("keeps configured and in-use Endpoints, but not one that stopped using cache", () => {
    const refs = cacheEndpointRefs([
      endpoint(1),
      endpoint(2, { spec: { kv_cache: null }, status: observed(true) }),
      endpoint(3, { spec: { kv_cache: null }, status: observed(false) }),
    ]);

    expect(refs.map((ref) => ref.name)).toEqual(["ep-1", "ep-2"]);
  });

  it("merges the configured and observed rows of one Endpoint and collects its nodes", () => {
    const refs = cacheEndpointRefs([
      endpoint(1, {
        metadata: { name: "chat", display_name: "Chat", workspace: "team-a" },
      }),
      endpoint(2, {
        metadata: { name: "chat", workspace: "team-a" },
        spec: { kv_cache: null },
        status: observed(true, ["node-a", "node-b", "node-a"]),
      }),
    ]);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      key: "team-a/chat",
      label: "Chat",
      workspace: "team-a",
      status: { phase: "Running" },
      nodes: ["node-a", "node-b"],
    });
  });

  it("falls back to the given workspace, then to default", () => {
    expect(cacheEndpointRefs([endpoint(1)], "team-b")[0].workspace).toBe(
      "team-b",
    );
    expect(cacheEndpointRefs([endpoint(1)])[0].workspace).toBe("default");
  });
});
