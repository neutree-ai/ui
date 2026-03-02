import { describe, expect, it } from "vitest";
import type { ExternalEndpointSpec, UpstreamSpec } from "../types";
import { getExposedModels } from "./get-exposed-models";

function makeUpstream(mapping: Record<string, string> | null): UpstreamSpec {
  return {
    upstream: { url: "https://example.com" },
    auth: null,
    model_mapping: mapping as unknown as Record<string, string>,
    models: null,
  };
}

function makeSpec(upstreams: UpstreamSpec[]): ExternalEndpointSpec {
  return { route_type: "/v1/chat/completions", timeout: null, upstreams };
}

describe("getExposedModels", () => {
  it("returns empty array for null spec", () => {
    expect(getExposedModels(null)).toEqual([]);
  });

  it("returns empty array when upstreams is empty", () => {
    expect(getExposedModels(makeSpec([]))).toEqual([]);
  });

  it("returns model keys from a single upstream", () => {
    const spec = makeSpec([
      makeUpstream({ "gpt-4o": "gpt-4o", "gpt-3.5": "gpt-3.5-turbo" }),
    ]);
    expect(getExposedModels(spec)).toEqual(["gpt-4o", "gpt-3.5"]);
  });

  it("aggregates models from multiple upstreams", () => {
    const spec = makeSpec([
      makeUpstream({ "model-a": "a" }),
      makeUpstream({ "model-b": "b", "model-c": "c" }),
    ]);
    expect(getExposedModels(spec)).toEqual(["model-a", "model-b", "model-c"]);
  });

  it("handles upstream with null model_mapping from API", () => {
    const spec = makeSpec([makeUpstream(null)]);
    expect(getExposedModels(spec)).toEqual([]);
  });

  it("skips upstreams with empty model_mapping", () => {
    const spec = makeSpec([makeUpstream({}), makeUpstream({ "model-x": "x" })]);
    expect(getExposedModels(spec)).toEqual(["model-x"]);
  });
});
