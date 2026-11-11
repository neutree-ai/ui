import { describe, expect, it } from "vitest";
import {
  cacheUpgradeErrorMessage,
  clusterCacheErrorMessage,
} from "./zcache-errors";

const t = (key: string, options?: Record<string, unknown>) =>
  options?.hint ? `${key}:${String(options.hint)}` : key;

describe("clusterCacheErrorMessage", () => {
  it.each([
    ["CLUSTER_CACHE_INVALID_OPTIONS", "clusters.zcache.errors.invalidOptions"],
    [
      "CLUSTER_CACHE_UNSUPPORTED_RUNTIME",
      "clusters.zcache.errors.unsupportedRuntime",
    ],
    [
      "CLUSTER_CACHE_USE_UPGRADE_ACTION",
      "clusters.zcache.errors.useUpgradeAction",
    ],
    [
      "CLUSTER_CACHE_VERSION_REQUIRED",
      "clusters.zcache.errors.versionRequired",
    ],
    ["CLUSTER_CACHE_INVALID_SPEC", "clusters.zcache.errors.invalidSpec"],
    [
      "CLUSTER_CACHE_INVALID_TARGET_NODES",
      "clusters.zcache.errors.invalidTargetNodes",
    ],
    ["CLUSTER_CACHE_IN_USE", "clusters.zcache.errors.inUseByEndpoints"],
  ])("maps cluster cache code %s to %s", (code, expected) => {
    expect(
      clusterCacheErrorMessage(t, { code, message: "raw server message" }),
    ).toBe(expected);
  });

  it("interpolates the invalid target node hint", () => {
    expect(
      clusterCacheErrorMessage(t, {
        code: "CLUSTER_CACHE_INVALID_TARGET_NODE",
        hint: "bad_node!",
        message: 'invalid cache target node "bad_node!"',
      }),
    ).toBe("clusters.zcache.errors.invalidTargetNode:bad_node!");
  });

  it("ignores unrelated cluster validation codes", () => {
    expect(
      clusterCacheErrorMessage(t, { code: "10208", message: "other" }),
    ).toBeUndefined();
  });
});

describe("cacheUpgradeErrorMessage", () => {
  it.each([
    ["21001", "clusters.cacheUpgrade.errors.licenseRequired"],
    [
      "CACHE_UPGRADE_INVALID_REQUEST",
      "clusters.cacheUpgrade.errors.invalidRequest",
    ],
    [
      "CACHE_UPGRADE_CLUSTER_PAUSED",
      "clusters.cacheUpgrade.errors.clusterPaused",
    ],
    [
      "CACHE_UPGRADE_IN_PROGRESS",
      "clusters.cacheUpgrade.errors.alreadyInProgress",
    ],
    [
      "CACHE_UPGRADE_CLUSTER_UNAVAILABLE",
      "clusters.cacheUpgrade.errors.clusterUnavailable",
    ],
    [
      "CACHE_UPGRADE_UNAVAILABLE",
      "clusters.cacheUpgrade.errors.cacheUnavailable",
    ],
    [
      "CACHE_UPGRADE_UNSUPPORTED_VERSION",
      "clusters.cacheUpgrade.errors.unsupportedVersion",
    ],
    [
      "CACHE_UPGRADE_INCOMPLETE_CHOICES",
      "clusters.cacheUpgrade.errors.incompleteChoices",
    ],
    [
      "CACHE_UPGRADE_INVALID_CHOICE",
      "clusters.cacheUpgrade.errors.invalidChoice",
    ],
  ])("maps upgrade code %s to %s", (code, expected) => {
    expect(
      cacheUpgradeErrorMessage(t, { code, message: "raw server message" }),
    ).toBe(expected);
  });

  it("interpolates the endpoint name hint for engine errors", () => {
    expect(
      cacheUpgradeErrorMessage(t, {
        code: "CACHE_UPGRADE_MISSING_ENGINE",
        hint: "qwen-ep",
        message: "endpoint qwen-ep has no engine",
      }),
    ).toBe("clusters.cacheUpgrade.errors.missingEngine:qwen-ep");
    expect(
      cacheUpgradeErrorMessage(t, {
        code: "CACHE_UPGRADE_ENGINE_INCOMPATIBLE",
        hint: "qwen-ep",
        message: "endpoint qwen-ep engine version is incompatible",
      }),
    ).toBe("clusters.cacheUpgrade.errors.engineIncompatible:qwen-ep");
  });

  it("maps RLS 42501 and HTTP 403 to permissionDenied", () => {
    expect(
      cacheUpgradeErrorMessage(t, {
        code: "42501",
        message: "permission denied to upgrade cluster cache",
      }),
    ).toBe("clusters.cacheUpgrade.errors.permissionDenied");
    expect(
      cacheUpgradeErrorMessage(t, {
        statusCode: 403,
        message: "Forbidden",
      }),
    ).toBe("clusters.cacheUpgrade.errors.permissionDenied");
  });

  it("returns undefined for unknown upgrade failures", () => {
    expect(
      cacheUpgradeErrorMessage(t, { code: "50000", message: "boom" }),
    ).toBeUndefined();
  });
});
