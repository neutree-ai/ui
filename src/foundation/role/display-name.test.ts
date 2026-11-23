import { describe, expect, it } from "vitest";
import { displayName } from "./display-name";

describe("displayName", () => {
  it.each([
    [{ name: "a", display_name: "Alpha" }, "Alpha"],
    [{ name: "a", display_name: " " }, "a"],
    [{ name: "a", display_name: null }, "a"],
    [{ name: "a" }, "a"],
  ])("%j -> %s", (metadata, label) => {
    expect(displayName(metadata)).toBe(label);
  });
});
