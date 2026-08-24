import { describe, expect, it } from "vitest";
import { engineNeedsModelSpec } from "./model-spec";

describe("engineNeedsModelSpec", () => {
  it("is false for the Flex engine", () => {
    expect(engineNeedsModelSpec("flex")).toBe(false);
  });

  it("is true for every other engine", () => {
    // Including engines the server already treats as self-contained: an
    // unrecognised engine must show a field too many, never a field too few.
    for (const engine of [
      "vllm",
      "llama-cpp",
      "sglang",
      "e2e",
      "some-new-engine",
    ]) {
      expect(engineNeedsModelSpec(engine)).toBe(true);
    }
  });

  it("is true while no engine is selected, so the fields start visible", () => {
    expect(engineNeedsModelSpec(undefined)).toBe(true);
    expect(engineNeedsModelSpec(null)).toBe(true);
    expect(engineNeedsModelSpec("")).toBe(true);
  });
});
