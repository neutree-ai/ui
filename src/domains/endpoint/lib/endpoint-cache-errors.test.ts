import { describe, expect, it } from "vitest";
import { endpointCacheErrorMessage } from "./endpoint-cache-errors";

const t = (key: string, options?: Record<string, unknown>) =>
  options?.hint ? `${key}:${String(options.hint)}` : key;

describe("endpointCacheErrorMessage", () => {
  it.each([
    [
      "ENDPOINT_CACHE_ENGINE_INCOMPATIBLE",
      "endpoints.kvCacheSettings.errors.engineIncompatible",
    ],
    [
      "ENDPOINT_CACHE_NODE_POOL_NOT_READY",
      "endpoints.kvCacheSettings.errors.nodePoolNotReady",
    ],
    [
      "ENDPOINT_CACHE_CLUSTER_DISABLED",
      "endpoints.kvCacheSettings.errors.clusterDisabled",
    ],
    [
      "ENDPOINT_CACHE_REQUIRES_VLLM",
      "endpoints.kvCacheSettings.errors.requiresVllm",
    ],
    [
      "ENDPOINT_CACHE_REQUIRES_TEXT_GENERATION",
      "endpoints.kvCacheSettings.errors.requiresTextGeneration",
    ],
    [
      "ENDPOINT_CACHE_INVALID_OPTIONS",
      "endpoints.kvCacheSettings.errors.invalidOptions",
    ],
    [
      "ENDPOINT_CACHE_INVALID_TIMEOUT",
      "endpoints.kvCacheSettings.errors.invalidTimeout",
    ],
  ])("maps code %s to %s", (code, expected) => {
    expect(
      endpointCacheErrorMessage(t, { code, message: "raw server message" }),
    ).toBe(expected);
  });

  it("passes the server hint for custom override errors", () => {
    expect(
      endpointCacheErrorMessage(t, {
        code: "ENDPOINT_CACHE_CUSTOM_OVERRIDE",
        hint: "LMCACHE_CHUNK_SIZE",
        message: "remove custom LMCACHE_CHUNK_SIZE",
      }),
    ).toBe(
      "endpoints.kvCacheSettings.errors.customOverride:LMCACHE_CHUNK_SIZE",
    );
  });

  it("returns undefined for unrelated error codes", () => {
    expect(
      endpointCacheErrorMessage(t, { code: "10232", message: "other" }),
    ).toBeUndefined();
  });
});
