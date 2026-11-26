import { describe, expect, it } from "vitest";
import { supportsZCache } from "./cluster-type";

describe("supportsZCache", () => {
  const zcache = { capabilities: { cluster_cache_providers: ["zcache"] } };

  it.each([
    { type: "kubernetes", info: zcache, expected: true },
    { type: "ssh", info: zcache, expected: false },
    { type: "kubernetes", info: { capabilities: {} }, expected: false },
    { type: "kubernetes", info: undefined, expected: false },
  ])("$type with $info: $expected", ({ type, info, expected }) => {
    expect(
      supportsZCache({ spec: { type } }, info && { version: "v1", ...info }),
    ).toBe(expected);
  });
});
