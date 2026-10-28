import { describe, expect, it } from "vitest";
import { nodeL1CacheByNode, nodeReading } from "./accelerator-observations";

describe("node L1 cache observations", () => {
  it("renders a cache node using the API name field", () => {
    const nodes = [
      {
        name: "gpu-a",
        runtime: "Ready",
        cache: "Available",
        capacity_bytes: 8 * 1024 ** 3,
      },
    ];
    const result = nodeL1CacheByNode(nodes, []);
    expect(result["gpu-a"]).toEqual({ usedGiB: null, capacityGiB: 8 });
  });
  it("uses the current runtime sample after a restart empties L1", () => {
    const metric = "neutree_cache_l1_memory_used_bytes";
    const samples = [
      {
        metric,
        labels: { node: "gpu-a" },
        value: 6 * 1024 ** 3,
        observed_at: 1000,
      },
      { metric, labels: { node: "gpu-a" }, value: 0, observed_at: 1040 },
    ];
    expect(nodeReading(samples, metric, "gpu-a")?.value).toBe(0);
  });
});
