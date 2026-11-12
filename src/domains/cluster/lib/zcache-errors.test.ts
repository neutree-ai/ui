import { describe, expect, it } from "vitest";
import {
  cacheUpgradeErrorMessage,
  clusterCacheErrorMessage,
} from "./zcache-errors";

const t = (key: string) => key;

describe("clusterCacheErrorMessage", () => {
  it.each([
    [
      "CLUSTER_CACHE_INVALID_TARGET_NODE",
      "clusters.zcache.errors.invalidTargetNode",
    ],
    ["CLUSTER_CACHE_IN_USE", "clusters.zcache.errors.inUseByEndpoints"],
  ])("translates %s", (code, key) => {
    expect(clusterCacheErrorMessage(t, { code })).toBe(key);
  });

  it("leaves other codes to the default notification", () => {
    expect(clusterCacheErrorMessage(t, { code: "10287" })).toBeUndefined();
  });
});

describe("cacheUpgradeErrorMessage", () => {
  it.each([
    ["21001", "clusters.cacheUpgrade.errors.licenseRequired"],
    [
      "CACHE_UPGRADE_IN_PROGRESS",
      "clusters.cacheUpgrade.errors.alreadyInProgress",
    ],
  ])("translates %s", (code, key) => {
    expect(cacheUpgradeErrorMessage(t, { code })).toBe(key);
  });

  it("explains a permission refusal", () => {
    expect(cacheUpgradeErrorMessage(t, { statusCode: 403 })).toBe(
      "clusters.cacheUpgrade.errors.permissionDenied",
    );
  });

  it("leaves other codes to the default notification", () => {
    expect(cacheUpgradeErrorMessage(t, { code: "10287" })).toBeUndefined();
  });
});
