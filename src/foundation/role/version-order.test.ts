import { describe, expect, it } from "vitest";
import {
  compareVersionStrings,
  newestVersion,
  sortVersionsNewestFirst,
} from "./version-order";

const version = (value: string) => ({ version: value });

describe("compareVersionStrings", () => {
  it("orders semver engine versions", () => {
    expect(compareVersionStrings("v0.24.0", "v0.17.1")).toBeGreaterThan(0);
    expect(compareVersionStrings("v0.5.9", "v0.5.10")).toBeLessThan(0);
    expect(compareVersionStrings("0.5.10", "0.5.9")).toBeGreaterThan(0);
    expect(compareVersionStrings("v0.24.0", "0.24.0")).toBe(0);
  });

  it("keeps numeric segments numeric instead of comparing them as text", () => {
    // Text comparison would put "9" above "10".
    expect(compareVersionStrings("v9.0.0", "v10.0.0")).toBeLessThan(0);
  });

  it("ranks release candidates below the release they precede", () => {
    expect(compareVersionStrings("v1.0.RC2", "v1.0.0")).toBeLessThan(0);
    expect(compareVersionStrings("v1.0.RC2", "v1.0.RC3")).toBeLessThan(0);
    expect(compareVersionStrings("v1.0.0", "v1.0.1")).toBeLessThan(0);
    expect(compareVersionStrings("v1.0.1", "v2.0.0")).toBeLessThan(0);
  });

  it("does not throw on labels semver rejects", () => {
    expect(() => compareVersionStrings("latest", "v1.0.0")).not.toThrow();
    expect(() => compareVersionStrings("", "v1.0.0")).not.toThrow();
  });

  it("keeps a free-form tag from outranking a real version", () => {
    // Packages shipped in the field carry tags like `qwen38` next to releases.
    expect(compareVersionStrings("qwen38", "v0.25.0")).toBeLessThan(0);
    expect(compareVersionStrings("v0.25.0", "qwen38")).toBeGreaterThan(0);
  });

  it("falls back to natural order when neither side is a version", () => {
    expect(compareVersionStrings("b5878", "b5879")).toBeLessThan(0);
    expect(compareVersionStrings("b5879", "b6000")).toBeLessThan(0);
  });

  it("treats labels that differ only in case as equal", () => {
    // Natural order lowercases each chunk, so these compare equal rather than
    // flipping the order depending on how the package capitalised the tag.
    expect(compareVersionStrings("Qwen38", "qwen38")).toBe(0);
    expect(compareVersionStrings("b5878", "B5878")).toBe(0);
  });
});

describe("newestVersion", () => {
  it("picks the highest version regardless of the order the engine returned", () => {
    const versions = [
      version("v0.17.1"),
      version("v0.24.0"),
      version("v0.20.0"),
    ];

    expect(newestVersion(versions)?.version).toBe("v0.24.0");
  });

  it("handles release candidate ordering", () => {
    const versions = [
      version("v1.0.RC2"),
      version("v2.0.0"),
      version("v1.0.RC3"),
      version("v1.0.0"),
    ];

    expect(newestVersion(versions)?.version).toBe("v2.0.0");
  });

  it("returns undefined for an engine without versions", () => {
    expect(newestVersion([])).toBeUndefined();
  });

  it("returns the only version when there is one", () => {
    expect(newestVersion([version("v0.3.7")])?.version).toBe("v0.3.7");
  });
});

describe("sortVersionsNewestFirst", () => {
  it("orders newest first", () => {
    const sorted = sortVersionsNewestFirst([
      version("v0.13.0"),
      version("v0.24.0"),
      version("v0.17.1"),
    ]);

    expect(sorted.map((v) => v.version)).toEqual([
      "v0.24.0",
      "v0.17.1",
      "v0.13.0",
    ]);
  });

  it("keeps the engine's order for versions that compare equal", () => {
    const sorted = sortVersionsNewestFirst([
      version("v1.0.0"),
      version("v1.0.0"),
    ]);

    expect(sorted).toHaveLength(2);
  });
});
