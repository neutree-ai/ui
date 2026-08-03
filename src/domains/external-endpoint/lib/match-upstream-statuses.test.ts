import { describe, expect, it } from "vitest";
import type {
  ExternalEndpointSpec,
  UpstreamSpec,
  UpstreamStatus,
} from "../types";
import { matchUpstreamStatuses } from "./match-upstream-statuses";

function externalUpstream(url: string): UpstreamSpec {
  return { upstream: { url }, auth: null, model_mapping: {}, models: null };
}

function refUpstream(name: string): UpstreamSpec {
  return { endpoint_ref: name, model_mapping: {}, models: null };
}

function makeSpec(upstreams: UpstreamSpec[]): ExternalEndpointSpec {
  return { route_type: "/v1/chat/completions", timeout: null, upstreams };
}

function ready(ref: string): UpstreamStatus {
  return { kind: "external", ref, phase: "Ready" };
}

describe("matchUpstreamStatuses", () => {
  it("returns an entry per spec upstream", () => {
    const spec = makeSpec([refUpstream("a"), externalUpstream("https://b")]);
    const result = matchUpstreamStatuses(spec, [
      ready("a"),
      ready("https://b"),
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]?.ref).toBe("a");
    expect(result[1]?.ref).toBe("https://b");
  });

  it("keeps the failure detail of the upstream it belongs to", () => {
    const spec = makeSpec([refUpstream("a"), refUpstream("b")]);
    const failed: UpstreamStatus = {
      kind: "endpoint_ref",
      ref: "b",
      phase: "Failed",
      models: ["model-b"],
      error_message: "endpoint not found",
    };

    const result = matchUpstreamStatuses(spec, [ready("a"), failed]);

    expect(result[0]?.phase).toBe("Ready");
    expect(result[1]).toBe(failed);
  });

  it("drops a status whose ref no longer matches that upstream", () => {
    const spec = makeSpec([refUpstream("a"), refUpstream("new")]);

    expect(matchUpstreamStatuses(spec, [ready("a"), ready("old")])).toEqual([
      ready("a"),
      null,
    ]);
  });

  it("matches an external upstream on its url", () => {
    const spec = makeSpec([externalUpstream("https://api.openai.com/v1")]);

    expect(
      matchUpstreamStatuses(spec, [ready("https://api.openai.com/v1")]),
    ).toEqual([ready("https://api.openai.com/v1")]);
  });

  it("returns nulls when the status carries no upstream detail", () => {
    const spec = makeSpec([refUpstream("a")]);

    expect(matchUpstreamStatuses(spec, null)).toEqual([null]);
    expect(matchUpstreamStatuses(spec, undefined)).toEqual([null]);
    expect(matchUpstreamStatuses(spec, [])).toEqual([null]);
  });

  it("returns an empty list when the spec has no upstreams", () => {
    expect(matchUpstreamStatuses(null, [ready("a")])).toEqual([]);
    expect(matchUpstreamStatuses(makeSpec([]), [ready("a")])).toEqual([]);
  });
});
