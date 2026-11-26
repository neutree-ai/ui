import { describe, expect, it } from "vitest";
import type { ClusterCacheStatus, ZCacheStatus } from "../types";
import {
  activeCacheChange,
  cacheFailed,
  isValidCacheCapacity,
  MAX_CACHE_CAPACITY_GIB,
  resolveZCacheState,
  sameCacheConfig,
  zcacheActivity,
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

  it.each([
    { value: 1, valid: true },
    { value: "16", valid: true },
    { value: MAX_CACHE_CAPACITY_GIB, valid: true },
    { value: MAX_CACHE_CAPACITY_GIB + 1, valid: false },
    { value: 0, valid: false },
    { value: 1.5, valid: false },
    { value: "", valid: false },
    { value: undefined, valid: false },
  ])("capacity $value -> valid: $valid", ({ value, valid }) => {
    expect(isValidCacheCapacity(value)).toBe(valid);
  });

  it.each([
    { phase: "Failed", control_plane: undefined, retryable: true },
    {
      phase: "Ready",
      control_plane: { ready: false, health_message: "down" },
      retryable: true,
    },
    {
      phase: "Ready",
      control_plane: { ready: true, health_message: "ok" },
      retryable: false,
    },
    { phase: "Ready", control_plane: { ready: false }, retryable: false },
  ] as const)(
    "phase $phase, control plane $control_plane -> retryable: $retryable",
    ({ phase, control_plane, retryable }) => {
      const summary = { provider: "zcache", phase, conditions: [] };
      const state = resolveZCacheState({
        summary,
        status: { control_plane },
      });
      expect(state.retryable).toBe(retryable);
      expect(cacheFailed(summary)).toBe(phase === "Failed");
    },
  );

  it.each([
    ["update_cache", 5, 5],
    ["update_cache", undefined, undefined],
    ["add_nodes", 5, undefined],
  ])("an active %s with L1 %s reports capacity %s", (kind, l1SizeGb, gib) => {
    const status: ZCacheStatus = {
      change: {
        phase: "Running",
        request: { operation: { kind }, lmcache: { l1SizeGb } },
      },
    };
    expect(resolveZCacheState({ status }).changeCapacityGiB).toBe(gib);
  });

  it("builds the activity sheet from the current change and past operations", () => {
    const { details, operations } = zcacheActivity(
      {
        provider: "zcache",
        phase: "Failed",
        conditions: [],
        error_message: "boom",
      },
      {
        change: { phase: "Rejected", message: "invalid" },
        operations: [
          {
            id: "op-1",
            kind: "add_nodes",
            phase: "Failed",
            nodes: [{ name: "a", phase: "Failed", reason: "no space" }],
          },
        ],
      },
    );
    expect(details).toEqual({
      open: true,
      errorMessage: "boom",
      observationError: undefined,
      change: {
        phaseKey: "clusters.zcache.operationFailed",
        message: "invalid",
        operationId: undefined,
      },
    });
    expect(operations).toEqual([
      {
        id: "op-1",
        labelKey: "clusters.zcache.actions.addNodes",
        phaseKey: "clusters.zcache.operationFailed",
        failed: true,
        createdAt: undefined,
        message: undefined,
        nodes: [
          {
            name: "a",
            phaseKey: "clusters.zcache.operationFailed",
            reason: "no space",
          },
        ],
      },
    ]);
  });

  it("has no current details without an error or change, and opens on an observation error", () => {
    expect(zcacheActivity(undefined, {}).details).toBeUndefined();
    expect(
      zcacheActivity(undefined, { observation_error: "unreachable" }).details
        ?.open,
    ).toBe(true);
  });
});
