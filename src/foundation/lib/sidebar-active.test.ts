import { describe, expect, it } from "vitest";
import { buildMenuItemPaths, isMenuItemActive } from "./sidebar-active";

describe("buildMenuItemPaths", () => {
  it("builds paths from all route fields", () => {
    const item = {
      list: "/:workspace/clusters",
      create: "/:workspace/clusters/create",
      edit: "/:workspace/clusters/edit/:id",
      show: "/:workspace/clusters/show/:id",
    };

    const paths = buildMenuItemPaths(item, "default", "my-cluster");

    expect(paths).toEqual([
      "/default/clusters",
      "/default/clusters/create",
      "/default/clusters/edit/my-cluster",
      "/default/clusters/show/my-cluster",
    ]);
  });

  it("filters out undefined route fields", () => {
    const item = {
      list: "/clusters",
    };

    const paths = buildMenuItemPaths(item, "default", "c1");

    expect(paths).toEqual(["/clusters"]);
  });

  it("handles empty item with no routes", () => {
    const paths = buildMenuItemPaths({}, "default", "c1");

    expect(paths).toEqual([]);
  });

  it("replaces :workspace in all paths", () => {
    const item = {
      list: "/:workspace/endpoints",
      edit: "/:workspace/endpoints/edit/:id",
    };

    const paths = buildMenuItemPaths(item, "prod", "ep-1");

    expect(paths).toEqual(["/prod/endpoints", "/prod/endpoints/edit/ep-1"]);
  });
});

describe("isMenuItemActive", () => {
  it("returns true for exact match", () => {
    expect(
      isMenuItemActive(["/clusters", "/clusters/create"], "/clusters"),
    ).toBe(true);
  });

  it("returns true when pathname is prefix of a path", () => {
    expect(isMenuItemActive(["/ws/clusters/show/c1"], "/ws/clusters")).toBe(
      true,
    );
  });

  it("returns true when a path is prefix of pathname", () => {
    expect(isMenuItemActive(["/ws/clusters"], "/ws/clusters/show/c1")).toBe(
      true,
    );
  });

  it("returns false when no match", () => {
    expect(
      isMenuItemActive(["/clusters", "/clusters/create"], "/endpoints"),
    ).toBe(false);
  });

  it("returns false for empty paths", () => {
    expect(isMenuItemActive([], "/clusters")).toBe(false);
  });
});
