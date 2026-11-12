import { describe, expect, it } from "vitest";
import { endpointCacheErrorMessage } from "./endpoint-cache-errors";

const t = (key: string) => key;

describe("endpointCacheErrorMessage", () => {
  it("translates a cache admission code", () => {
    expect(
      endpointCacheErrorMessage(t, { code: "ENDPOINT_CACHE_REQUIRES_VLLM" }),
    ).toBe("endpoints.kvCacheSettings.errors.requiresVllm");
  });

  it("leaves other codes to the default notification", () => {
    expect(endpointCacheErrorMessage(t, { code: "10287" })).toBeUndefined();
  });
});
