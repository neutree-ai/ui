import { describe, expect, it } from "vitest";
import type { ZCacheStatus } from "../types";
import { activeCacheChange, sameCacheConfig } from "./zcache-presentation";

describe("cache presentation", () => {
  it("ignores node ordering but not capacity or membership", () => {
    const spec = { enabled: true, l1_size_gib: 2, target_nodes: ["a", "b"] };
    expect(sameCacheConfig(spec, { ...spec, target_nodes: ["b", "a"] })).toBe(
      true,
    );
    expect(sameCacheConfig(spec, { ...spec, l1_size_gib: 5 })).toBe(false);
    expect(sameCacheConfig(spec, { ...spec, target_nodes: ["a"] })).toBe(false);
  });
  it("still considers an ambiguous submission active after an observation error", () => {
    const status: ZCacheStatus = {
      phase: "Failed",
      change: { phase: "Submitting" },
    };
    expect(activeCacheChange(status)).toBe(status.change);
    for (const phase of ["Succeeded", "Failed", "Rejected"])
      expect(
        activeCacheChange({ ...status, change: { phase } }),
      ).toBeUndefined();
  });
});
