import { describe, expect, it } from "vitest";
import { endpointCacheErrorMessage } from "./endpoint-cache-errors";

const t = (key: string, options?: Record<string, unknown>) =>
  options?.hint ? `${key}:${String(options.hint)}` : key;

describe("endpointCacheErrorMessage", () => {
  it.each([
    ["21101", "endpoints.kvCacheSettings.errors.engineIncompatible"],
    ["21102", "endpoints.kvCacheSettings.errors.nodePoolNotReady"],
    ["21103", "endpoints.kvCacheSettings.errors.clusterDisabled"],
    ["21104", "endpoints.kvCacheSettings.errors.requiresVllm"],
    ["21105", "endpoints.kvCacheSettings.errors.requiresTextGeneration"],
    ["21106", "endpoints.kvCacheSettings.errors.invalidOptions"],
    ["21107", "endpoints.kvCacheSettings.errors.invalidTimeout"],
  ])("maps code %s to %s", (code, expected) => {
    expect(
      endpointCacheErrorMessage(t, { code, message: "raw server message" }),
    ).toBe(expected);
  });

  it("passes the server hint for custom override errors", () => {
    expect(
      endpointCacheErrorMessage(t, {
        code: "21108",
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
