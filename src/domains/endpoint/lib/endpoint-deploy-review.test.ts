import { describe, expect, it } from "vitest";
import { makeEndpoint } from "@/domains/endpoint/testing/builders";
import { endpointReviewSummary } from "./endpoint-deploy-review";

describe("endpointReviewSummary", () => {
  it("shows dashes, zero resources, one replica and no cache for an empty form", () => {
    const values = makeEndpoint({
      spec: {
        cluster: "",
        model: null,
        engine: { engine: "", version: "" },
        resources: null,
        replicas: null,
      },
    });
    expect(endpointReviewSummary(values)).toEqual({
      model: "—",
      resources: { cluster: "—", count: 1, cpu: 0, memory: 0, gpu: 0 },
      engine: { engine: "—", version: "—" },
      cacheTimeout: null,
    });
  });

  it.each([
    [{ provider: "zcache" }, 5],
    [{ provider: "zcache", options: { timeout_seconds: 1.5 } }, 1.5],
  ])("an enabled cache %o reports timeout %s", (kv_cache, timeout) => {
    expect(
      endpointReviewSummary(makeEndpoint({ spec: { kv_cache } })).cacheTimeout,
    ).toBe(timeout);
  });
});
