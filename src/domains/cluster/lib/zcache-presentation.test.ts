import { describe, expect, it } from "vitest";
import type { ClusterCacheStatus, ZCacheStatus } from "../types";
import {
  activeCacheChange,
  resolveZCacheState,
  sameCacheConfig,
} from "./zcache-presentation";

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
      change: { phase: "Submitting" },
    };
    expect(activeCacheChange(status)).toBe(status.change);
    for (const phase of ["Succeeded", "Failed", "Rejected"])
      expect(
        activeCacheChange({ ...status, change: { phase } }),
      ).toBeUndefined();
  });

  it("derives cache lifecycle, observation trust and availability as separate facts", () => {
    const desired = {
      enabled: true,
      l1_size_gib: 8,
      target_nodes: ["a"],
    };
    const summary = (
      phase: ClusterCacheStatus["phase"],
      readyStatus: "True" | "False" | "Unknown",
    ): ClusterCacheStatus => ({
      provider: "zcache",
      phase,
      conditions: [{ type: "Ready", status: readyStatus, reason: "test" }],
    });
    const observed: ZCacheStatus = {
      observed_at: "now",
      current: desired,
      change: { phase: "Running" },
    };

    expect(
      resolveZCacheState({
        desired,
        summary: summary("Ready", "True"),
        status: observed,
      }),
    ).toMatchObject({
      activeChange: observed.change,
      availability: "available",
      phase: "Ready",
      resultLabelKey: "clusters.zcache.applied",
      stale: false,
    });
    expect(
      resolveZCacheState({
        desired: { ...desired, l1_size_gib: 4 },
        summary: summary("Ready", "True"),
        status: observed,
      }),
    ).toMatchObject({
      basePhase: "Ready",
      phase: "Reconciling",
      resultLabelKey: "clusters.zcache.reconciling",
    });
    expect(
      resolveZCacheState({
        desired,
        summary: summary("Unavailable", "False"),
        status: { ...observed, current: undefined },
      }),
    ).toMatchObject({
      availability: "unavailable",
      phase: "Unavailable",
      resultLabelKey: "clusters.zcache.unavailable",
    });
    expect(
      resolveZCacheState({
        desired,
        summary: summary("Unavailable", "Unknown"),
        status: { observed_at: "old" },
      }),
    ).toMatchObject({
      availability: "unknown",
      resultLabelKey: "clusters.zcache.unknown",
      stale: true,
    });
    expect(
      resolveZCacheState({
        desired,
        summary: summary("Failed", "True"),
        status: observed,
      }),
    ).toMatchObject({
      availability: "available",
      phase: "Failed",
      resultLabelKey: "clusters.zcache.failed",
    });
  });

  it("treats missing configuration as disabled and a new enable as reconciling", () => {
    expect(resolveZCacheState({})).toMatchObject({
      availability: "unknown",
      phase: "Disabled",
      resultLabelKey: "clusters.zcache.disabled",
      stale: true,
    });
    expect(
      resolveZCacheState({
        desired: {
          enabled: true,
          l1_size_gib: 8,
          target_nodes: ["a"],
        },
      }),
    ).toMatchObject({
      desiredEnabled: true,
      phase: "Reconciling",
      resultLabelKey: "clusters.zcache.reconciling",
    });
  });
});
