import { describe, expect, it } from "vitest";
import { getUpgradeVersions, isUpgradeVersion } from "./upgrade-versions";

describe("getUpgradeVersions", () => {
  it("keeps only strictly newer versions than the current spec version", () => {
    expect(
      getUpgradeVersions(["v1.0.1", "v1.0.2", "v1.1.0", "v1.2.0"], "v1.1.0"),
    ).toEqual(["v1.2.0"]);
  });

  it("sorts valid versions and removes duplicates", () => {
    expect(
      getUpgradeVersions(["v1.2.0", "v1.1.2", "v1.2.0", "v1.1.1"], "v1.0.1"),
    ).toEqual(["v1.1.1", "v1.1.2", "v1.2.0"]);
  });

  it("orders prereleases before their matching stable version", () => {
    expect(
      getUpgradeVersions(["v1.2.0", "v1.2.0-rc.1", "v1.1.0"], "v1.1.0"),
    ).toEqual(["v1.2.0-rc.1", "v1.2.0"]);
  });

  it("orders nightly, rc, and stable releases while rejecting prerelease downgrades", () => {
    expect(
      getUpgradeVersions(
        ["v1.2.0", "v1.2.0-rc.1", "v1.2.0-nightly.1", "v1.1.0"],
        "v1.1.0",
      ),
    ).toEqual(["v1.2.0-nightly.1", "v1.2.0-rc.1", "v1.2.0"]);
    expect(
      getUpgradeVersions(
        ["v1.2.0", "v1.2.0-rc.1", "v1.2.0-nightly.1"],
        "v1.2.0-rc.1",
      ),
    ).toEqual(["v1.2.0"]);
  });

  it("accepts a prerelease from a higher minor version", () => {
    expect(
      getUpgradeVersions(["v1.2.0-rc.1", "v1.2.0-nightly.1"], "v1.1.0"),
    ).toEqual(["v1.2.0-nightly.1", "v1.2.0-rc.1"]);
  });

  it("drops invalid candidate versions", () => {
    expect(
      getUpgradeVersions(["v1.2.0", "not-a-version", "v1.0.1"], "v1.0.1"),
    ).toEqual(["v1.2.0"]);
  });

  it("keeps every valid candidate when the current spec version is missing or invalid", () => {
    expect(getUpgradeVersions(["v1.2.0", "v1.0.2", "bad"], undefined)).toEqual([
      "v1.0.2",
      "v1.2.0",
    ]);
    expect(getUpgradeVersions(["v1.2.0", "v1.0.2", "bad"], "unknown")).toEqual([
      "v1.0.2",
      "v1.2.0",
    ]);
  });
});

describe("isUpgradeVersion", () => {
  it("rejects equal, lower, invalid, and missing targets", () => {
    expect(isUpgradeVersion("v1.2.0", "v1.1.0")).toBe(true);
    expect(isUpgradeVersion("v1.1.0", "v1.1.0")).toBe(false);
    expect(isUpgradeVersion("v1.0.2", "v1.1.0")).toBe(false);
    expect(isUpgradeVersion("invalid", "v1.1.0")).toBe(false);
    expect(isUpgradeVersion(undefined, "v1.1.0")).toBe(false);
    expect(isUpgradeVersion("v1.2.0", undefined)).toBe(true);
    expect(isUpgradeVersion("v1.2.0", "unknown")).toBe(true);
  });
});
