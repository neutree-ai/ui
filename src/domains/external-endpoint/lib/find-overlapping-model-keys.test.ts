import { describe, expect, it } from "vitest";
import { findOverlappingModelKeys } from "./find-overlapping-model-keys";

type U = { model_mapping: Record<string, string> };

describe("findOverlappingModelKeys", () => {
  it("returns empty when no overlap exists", () => {
    const upstreams: U[] = [
      { model_mapping: { "gpt-4": "gpt-4" } },
      { model_mapping: { "gpt-3.5": "gpt-3.5-turbo" } },
    ];
    expect(findOverlappingModelKeys(upstreams, 0)).toEqual([]);
    expect(findOverlappingModelKeys(upstreams, 1)).toEqual([]);
  });

  it("returns overlapping keys", () => {
    const upstreams: U[] = [
      { model_mapping: { "gpt-4": "gpt-4", "gpt-3.5": "gpt-3.5-turbo" } },
      { model_mapping: { "gpt-4": "gpt-4o", claude: "claude-3" } },
    ];
    expect(findOverlappingModelKeys(upstreams, 0)).toEqual(["gpt-4"]);
    expect(findOverlappingModelKeys(upstreams, 1)).toEqual(["gpt-4"]);
  });

  it("handles three upstreams with shared keys", () => {
    const upstreams: U[] = [
      { model_mapping: { a: "1", b: "2" } },
      { model_mapping: { b: "3", c: "4" } },
      { model_mapping: { c: "5", a: "6" } },
    ];
    expect(findOverlappingModelKeys(upstreams, 0)).toEqual(["a", "b"]);
    expect(findOverlappingModelKeys(upstreams, 1)).toEqual(["b", "c"]);
    expect(findOverlappingModelKeys(upstreams, 2)).toEqual(["c", "a"]);
  });

  it("ignores empty keys", () => {
    const upstreams: U[] = [
      { model_mapping: { "": "empty", a: "1" } },
      { model_mapping: { "": "also-empty", b: "2" } },
    ];
    expect(findOverlappingModelKeys(upstreams, 0)).toEqual([]);
    expect(findOverlappingModelKeys(upstreams, 1)).toEqual([]);
  });

  it("returns empty for single upstream", () => {
    const upstreams: U[] = [{ model_mapping: { "gpt-4": "gpt-4" } }];
    expect(findOverlappingModelKeys(upstreams, 0)).toEqual([]);
  });

  it("handles empty model_mapping", () => {
    const upstreams: U[] = [
      { model_mapping: {} },
      { model_mapping: { a: "1" } },
    ];
    expect(findOverlappingModelKeys(upstreams, 0)).toEqual([]);
    expect(findOverlappingModelKeys(upstreams, 1)).toEqual([]);
  });
});
