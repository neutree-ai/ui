import { describe, expect, it } from "vitest";
import {
  cacheUpgradeErrorMessage,
  clusterCacheErrorMessage,
} from "./zcache-errors";

const t = (key: string, options?: Record<string, unknown>) =>
  options?.hint ? `${key}:${String(options.hint)}` : key;

describe("clusterCacheErrorMessage", () => {
  it.each([
    ["21110", "clusters.zcache.errors.invalidOptions"],
    ["21112", "clusters.zcache.errors.unsupportedRuntime"],
    ["21113", "clusters.zcache.errors.useUpgradeAction"],
    ["21114", "clusters.zcache.errors.versionRequired"],
    ["21115", "clusters.zcache.errors.invalidSpec"],
    ["21116", "clusters.zcache.errors.invalidTargetNodes"],
    ["21117", "clusters.zcache.errors.inUseByEndpoints"],
  ])("maps cluster cache code %s to %s", (code, expected) => {
    expect(
      clusterCacheErrorMessage(t, { code, message: "raw server message" }),
    ).toBe(expected);
  });

  it("interpolates the invalid target node hint", () => {
    expect(
      clusterCacheErrorMessage(t, {
        code: "21111",
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
    ["21121", "clusters.cacheUpgrade.errors.invalidRequest"],
    ["21122", "clusters.cacheUpgrade.errors.clusterPaused"],
    ["21123", "clusters.cacheUpgrade.errors.alreadyInProgress"],
    ["21124", "clusters.cacheUpgrade.errors.clusterUnavailable"],
    ["21125", "clusters.cacheUpgrade.errors.cacheUnavailable"],
    ["21126", "clusters.cacheUpgrade.errors.unsupportedVersion"],
    ["21127", "clusters.cacheUpgrade.errors.incompleteChoices"],
    ["21128", "clusters.cacheUpgrade.errors.invalidChoice"],
  ])("maps upgrade code %s to %s", (code, expected) => {
    expect(
      cacheUpgradeErrorMessage(t, { code, message: "raw server message" }),
    ).toBe(expected);
  });

  it("interpolates the endpoint name hint for engine errors", () => {
    expect(
      cacheUpgradeErrorMessage(t, {
        code: "21129",
        hint: "qwen-ep",
        message: "endpoint qwen-ep has no engine",
      }),
    ).toBe("clusters.cacheUpgrade.errors.missingEngine:qwen-ep");
    expect(
      cacheUpgradeErrorMessage(t, {
        code: "21130",
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
