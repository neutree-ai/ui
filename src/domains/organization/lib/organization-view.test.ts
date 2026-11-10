import { describe, expect, it } from "vitest";
import {
  readOrganizationView,
  writeOrganizationView,
} from "./organization-view";

const read = (query: string) =>
  readOrganizationView(new URLSearchParams(query));
const write = (
  query: string,
  change: Parameters<typeof writeOrganizationView>[1],
) =>
  decodeURIComponent(
    writeOrganizationView(new URLSearchParams(query), change).toString(),
  );

describe("organization view in the URL", () => {
  it("reads the defaults from an empty query", () => {
    expect(read("")).toEqual({
      tab: "departments",
      department: undefined,
      expanded: null,
      team: undefined,
    });
    expect(read("tab=bogus").tab).toBe("departments");
  });

  it("reads a tab, a selection and the expanded nodes", () => {
    expect(
      read("tab=teams&team=guild&department=rnd&expanded=a&expanded=b"),
    ).toEqual({
      tab: "teams",
      department: "rnd",
      expanded: ["a", "b"],
      team: "guild",
    });
    // Everything collapsed differs from the default.
    expect(read("expanded=").expanded).toEqual([]);
  });

  it("replaces only the parts it is given", () => {
    expect(write("department=rnd&x=1", { tab: "teams" })).toBe(
      "department=rnd&x=1&tab=teams",
    );
    expect(
      write("tab=teams&team=guild", { tab: "departments", team: undefined }),
    ).toBe("");
    expect(write("expanded=a", { expanded: ["b", "c"] })).toBe(
      "expanded=b&expanded=c",
    );
    expect(write("expanded=a", { expanded: [] })).toBe("expanded=");
    expect(write("expanded=a&department=rnd", { expanded: null })).toBe(
      "department=rnd",
    );
  });

  it("round-trips a view", () => {
    const view = {
      tab: "teams" as const,
      department: "rnd",
      expanded: ["org-test", "rnd"],
      team: "demo",
    };
    expect(
      readOrganizationView(writeOrganizationView(new URLSearchParams(), view)),
    ).toEqual(view);
  });
});
