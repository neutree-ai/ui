import { describe, expect, it } from "vitest";
import { makeUpstream } from "../testing/fixtures";
import {
  endpointRefOptions,
  hasInvalidUpstreamNames,
  nameUnnamedUpstreams,
  newUpstreamName,
  quickUpstream,
} from "./external-endpoint-form-upstreams";

describe("quickUpstream", () => {
  const input = { url: "https://x", endpointRef: "ep", credential: "k" };
  it.each([
    {
      type: "external" as const,
      shape: {
        upstream: { url: "https://x" },
        auth: { type: "bearer", credential: "k" },
      },
    },
    {
      type: "endpoint_ref" as const,
      shape: { upstream: null, auth: null, endpoint_ref: "ep" },
    },
  ])("builds an $type upstream", ({ type, shape }) => {
    expect(quickUpstream(type, input)).toEqual({
      model_mapping: {},
      models: null,
      ...shape,
    });
  });
});

describe("upstream names", () => {
  it("takes the first provider-N no stored or current name uses", () => {
    expect(
      newUpstreamName(["provider-1"], [makeUpstream({ name: "provider-2" })]),
    ).toBe("provider-3");
  });

  it.each([
    { names: ["a", "b"], invalid: false },
    { names: ["a", ""], invalid: true },
    { names: ["a", "a"], invalid: true },
  ])("$names invalid: $invalid", ({ names, invalid }) => {
    expect(hasInvalidUpstreamNames(names)).toBe(invalid);
  });

  it("names only rows with neither a stored nor a current name, keeping the others", () => {
    const upstreams = [
      makeUpstream({ name: "" }),
      makeUpstream({ name: "provider-1" }),
      makeUpstream({ name: "" }),
    ];
    const named = nameUnnamedUpstreams(upstreams, ["", "provider-1", "kept"]);
    expect(named.map((u) => u.name)).toEqual(["provider-2", "provider-1", ""]);
    expect(named[1]).toBe(upstreams[1]);
  });
});

describe("endpointRefOptions", () => {
  it("lists Running first and keeps a status only with a phase", () => {
    const options = endpointRefOptions([
      { metadata: { name: "pending" }, status: { phase: "Pending" } },
      { metadata: { name: "none" }, status: {} },
      { metadata: { name: "running" }, status: { phase: "Running" } },
    ]);
    expect(options.map((o) => [o.value, o.status?.phase])).toEqual([
      ["running", "Running"],
      ["pending", "Pending"],
      ["none", undefined],
    ]);
  });
});
