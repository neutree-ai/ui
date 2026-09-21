import { describe, expect, it } from "vitest";
import type { EngineVersion } from "@/domains/engine/types";
import {
  compareEngineVersions,
  newestEngineVersion,
  sortEngineVersionsNewestFirst,
} from "./version-order";

const version = (value: string): EngineVersion => ({
  version: value,
  values_schema: {},
});

describe("compareEngineVersions", () => {
  it("orders semver engine versions", () => {
    expect(compareEngineVersions("v0.24.0", "v0.17.1")).toBeGreaterThan(0);
    expect(compareEngineVersions("v0.5.9", "v0.5.10")).toBeLessThan(0);
    expect(compareEngineVersions("0.5.10", "0.5.9")).toBeGreaterThan(0);
    expect(compareEngineVersions("v0.24.0", "0.24.0")).toBe(0);
  });

  it("keeps numeric segments numeric instead of comparing them as text", () => {
    // Text comparison would put "9" above "10".
    expect(compareEngineVersions("v9.0.0", "v10.0.0")).toBeLessThan(0);
  });

  it("ranks release candidates below the release they precede", () => {
    expect(compareEngineVersions("v1.0.RC2", "v1.0.0")).toBeLessThan(0);
    expect(compareEngineVersions("v1.0.RC2", "v1.0.RC3")).toBeLessThan(0);
    expect(compareEngineVersions("v1.0.0", "v1.0.1")).toBeLessThan(0);
    expect(compareEngineVersions("v1.0.1", "v2.0.0")).toBeLessThan(0);
  });

  it("does not throw on labels semver rejects", () => {
    expect(() => compareEngineVersions("latest", "v1.0.0")).not.toThrow();
    expect(() => compareEngineVersions("", "v1.0.0")).not.toThrow();
  });

  it("keeps a free-form tag from outranking a real version", () => {
    // Packages shipped in the field carry tags like `qwen38` next to releases.
    expect(compareEngineVersions("qwen38", "v0.25.0")).toBeLessThan(0);
    expect(compareEngineVersions("v0.25.0", "qwen38")).toBeGreaterThan(0);
  });

  it("falls back to natural order when neither side is a version", () => {
    expect(compareEngineVersions("b5878", "b5879")).toBeLessThan(0);
    expect(compareEngineVersions("b5879", "b6000")).toBeLessThan(0);
  });
});

describe("newestEngineVersion", () => {
  it("picks the highest version regardless of the order the engine returned", () => {
    const versions = [
      version("v0.17.1"),
      version("v0.24.0"),
      version("v0.20.0"),
    ];

    expect(newestEngineVersion(versions)?.version).toBe("v0.24.0");
  });

  it("handles release candidate ordering", () => {
    const versions = [
      version("v1.0.RC2"),
      version("v2.0.0"),
      version("v1.0.RC3"),
      version("v1.0.0"),
    ];

    expect(newestEngineVersion(versions)?.version).toBe("v2.0.0");
  });

  it("returns undefined for an engine without versions", () => {
    expect(newestEngineVersion([])).toBeUndefined();
  });

  it("returns the only version when there is one", () => {
    expect(newestEngineVersion([version("v0.3.7")])?.version).toBe("v0.3.7");
  });
});

describe("sortEngineVersionsNewestFirst", () => {
  it("orders newest first", () => {
    const sorted = sortEngineVersionsNewestFirst([
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
    const sorted = sortEngineVersionsNewestFirst([
      version("v1.0.0"),
      version("v1.0.0"),
    ]);

    expect(sorted).toHaveLength(2);
  });
});
