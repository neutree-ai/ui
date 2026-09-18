import { describe, expect, it } from "vitest";
import type { ExternalEndpointSpec, UpstreamSpec } from "../types";
import { getUpstreamModelMappings } from "./get-upstream-model-mappings";

const upstream: UpstreamSpec = {
  name: "a",
  models: null,
  model_mapping: { old: "legacy" },
};
const spec: ExternalEndpointSpec = { timeout: null, upstreams: [upstream] };

describe("getUpstreamModelMappings", () => {
  it("groups explicit mappings within one upstream and ignores legacy mappings", () => {
    const routes: ExternalEndpointSpec = {
      ...spec,
      model_routes: [
        {
          model: "one",
          strategy: "weighted",
          targets: [
            { upstream: "a", upstream_model: "source" },
            { upstream: "a", upstream_model: "source" },
            { upstream: "b", upstream_model: "other" },
          ],
        },
        {
          model: "two",
          strategy: "fixed",
          targets: [{ upstream: "a", upstream_model: "source" }],
        },
      ],
    };
    expect(getUpstreamModelMappings(routes, upstream)).toEqual([
      { upstreamModel: "source", exposedModels: ["one", "two"] },
    ]);
    expect(
      getUpstreamModelMappings(routes, { ...upstream, name: "unused" }),
    ).toEqual([]);
  });

  it("groups legacy aliases when there are no explicit routes", () => {
    expect(
      getUpstreamModelMappings(
        { ...spec, model_routes: [] },
        {
          ...upstream,
          model_mapping: { first: "source", second: "source", third: "other" },
        },
      ),
    ).toEqual([
      { upstreamModel: "source", exposedModels: ["first", "second"] },
      { upstreamModel: "other", exposedModels: ["third"] },
    ]);
  });

  it("does not turn discovered models into configured mappings", () => {
    expect(
      getUpstreamModelMappings(spec, {
        ...upstream,
        models: ["discovered"],
        model_mapping: {},
      }),
    ).toEqual([]);
  });
});
