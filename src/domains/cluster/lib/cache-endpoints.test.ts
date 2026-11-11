import { describe, expect, it } from "vitest";
import { cacheEndpointRefs } from "./cache-endpoints";

describe("cacheEndpointRefs", () => {
  it("keeps configured and observed cache users once, then links by resource name", () => {
    expect(
      cacheEndpointRefs(
        [
          {
            id: 1,
            metadata: {
              name: "chat-api",
              display_name: "Chat API",
              workspace: "team-a",
            },
            spec: { kv_cache: { provider: "zcache" } },
          },
          {
            id: 2,
            metadata: { name: "chat-api", workspace: "team-a" },
            spec: { kv_cache: null },
            status: {
              phase: "Running",
              kv_cache: { provider: "zcache", details: { in_use: true } },
              resources: {
                replicas: [
                  {
                    instance_id: "chat-api-0",
                    node_id: "gpu-node-a",
                    devices: [
                      {
                        uuid: "gpu-a",
                        product: "H100",
                        memory_mib: 81920,
                        core_units: 100,
                        node_id: "gpu-node-a",
                      },
                    ],
                  },
                  {
                    instance_id: "chat-api-1",
                    node_id: "gpu-node-b",
                  },
                ],
              },
            },
          },
          {
            id: 3,
            metadata: { name: "configured-only" },
            spec: { kv_cache: { provider: "zcache" } },
            status: { phase: "Paused" },
          },
          {
            id: 4,
            metadata: { name: "unrelated" },
            spec: { kv_cache: null },
            status: {
              kv_cache: { provider: "zcache", details: { in_use: false } },
            },
          },
        ],
        "default",
      ),
    ).toEqual([
      {
        key: "team-a/chat-api",
        label: "Chat API",
        name: "chat-api",
        workspace: "team-a",
        status: {
          phase: "Running",
          kv_cache: { provider: "zcache", details: { in_use: true } },
          resources: {
            replicas: [
              {
                instance_id: "chat-api-0",
                node_id: "gpu-node-a",
                devices: [
                  {
                    uuid: "gpu-a",
                    product: "H100",
                    memory_mib: 81920,
                    core_units: 100,
                    node_id: "gpu-node-a",
                  },
                ],
              },
              {
                instance_id: "chat-api-1",
                node_id: "gpu-node-b",
              },
            ],
          },
        },
        nodes: ["gpu-node-a", "gpu-node-b"],
      },
      {
        key: "default/configured-only",
        label: "configured-only",
        name: "configured-only",
        workspace: "default",
        status: { phase: "Paused" },
        nodes: [],
      },
    ]);
  });
});
