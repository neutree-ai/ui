import { describe, expect, it } from "vitest";
import type { ExternalEndpointSpec } from "@/domains/external-endpoint/types";
import { getEndpointType } from "./get-endpoint-type";

const makeSpec = (
  upstreams: Array<{ endpoint_ref?: string }>,
): ExternalEndpointSpec => ({
  timeout: null,
  upstreams: upstreams.map((u) => ({
    ...u,
    model_mapping: {},
    models: null,
    upstream: u.endpoint_ref ? null : { url: "https://api.example.com" },
  })),
});

describe("getEndpointType", () => {
  it("returns null for null spec", () => {
    expect(getEndpointType(null)).toBeNull();
  });

  it("returns null for empty upstreams", () => {
    expect(getEndpointType({ timeout: null, upstreams: [] })).toBeNull();
  });

  it('returns "external" when all upstreams are external', () => {
    expect(getEndpointType(makeSpec([{}, {}]))).toBe("external");
  });

  it('returns "endpoint_ref" when all upstreams use endpoint_ref', () => {
    expect(
      getEndpointType(
        makeSpec([{ endpoint_ref: "ep-1" }, { endpoint_ref: "ep-2" }]),
      ),
    ).toBe("endpoint_ref");
  });

  it('returns "mixed" when upstreams have both types', () => {
    expect(getEndpointType(makeSpec([{}, { endpoint_ref: "ep-1" }]))).toBe(
      "mixed",
    );
  });

  it('returns "external" for a single external upstream', () => {
    expect(getEndpointType(makeSpec([{}]))).toBe("external");
  });

  it('returns "endpoint_ref" for a single endpoint_ref upstream', () => {
    expect(getEndpointType(makeSpec([{ endpoint_ref: "ep-1" }]))).toBe(
      "endpoint_ref",
    );
  });
});
