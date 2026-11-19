import { describe, expect, it } from "vitest";
import {
  type CacheEndpointCandidate,
  cacheEndpointRefs,
} from "./cache-endpoints";

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

const endpoint = (
  id: number,
  overrides: Partial<CacheEndpointCandidate> = {},
): CacheEndpointCandidate => ({
  id,
  metadata: { name: `ep-${id}` },
  status: observed(true),
  ...overrides,
});

describe("cacheEndpointRefs", () => {
  it("keeps actively in-use Endpoints, excluding paused or unscheduled ones", () => {
    const refs = cacheEndpointRefs([
      endpoint(1, { status: observed(false) }),
      endpoint(2, { status: undefined }),
      endpoint(3, { status: observed(true) }),
      endpoint(4, {
        status: {
          phase: "Running",
          kv_cache: { provider: "lmcache", details: { in_use: true } },
        },
      }),
    ]);

    expect(refs.map((ref) => ref.name)).toEqual(["ep-3"]);
  });

  it("deduplicates one Endpoint across rows and collects its nodes", () => {
    const refs = cacheEndpointRefs([
      endpoint(1, {
        metadata: { name: "chat", display_name: "Chat", workspace: "team-a" },
        status: {
          kv_cache: { provider: "zcache", details: { in_use: true } },
        },
      }),
      endpoint(2, {
        metadata: { name: "chat", workspace: "team-a" },
        status: observed(true, ["node-a", "node-b", "node-a"]),
      }),
    ]);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      key: "team-a/chat",
      label: "Chat",
      workspace: "team-a",
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
