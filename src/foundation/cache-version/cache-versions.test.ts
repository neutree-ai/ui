import { describe, expect, it } from "vitest";
import { engineVersionsFor } from "./cache-versions";

const versions = [
  { version: "v0.5.0", engine_versions: ["v0.24.0"] },
  { version: "v0.5.5", engine_versions: ["v0.31.0", "v0.32.0"] },
];

describe("engineVersionsFor", () => {
  it.each([
    { runtime: "v0.5.5", expected: ["v0.31.0", "v0.32.0"] },
    { runtime: "v9.9.9", expected: [] },
    { runtime: undefined, expected: [] },
  ])("runtime $runtime -> $expected", ({ runtime, expected }) => {
    expect(engineVersionsFor(versions, runtime)).toEqual(expected);
  });

  it("returns nothing while the catalog is not loaded", () => {
    expect(engineVersionsFor(undefined, "v0.5.0")).toEqual([]);
  });
});
