import { describe, expect, it } from "vitest";
import {
  addEntries,
  buildGroupPolicySpec,
  hasRules,
  removeEntry,
} from "./model-entries";

describe("addEntries", () => {
  it("scopes to a workspace, or to all when empty, and skips duplicates", () => {
    const one = addEntries([], ["m1", " m1 ", ""], "");
    expect(one).toEqual([{ model: "m1" }]);
    const two = addEntries(one, ["m1"], "ws");
    expect(two).toEqual([{ model: "m1" }, { model: "m1", workspace: "ws" }]);
    expect(addEntries(two, ["m1"], "ws")).toHaveLength(2);
  });
});

describe("removeEntry", () => {
  it("removes only the entry with the same workspace", () => {
    const entries = [{ model: "m" }, { model: "m", workspace: "ws" }];
    expect(removeEntry(entries, { model: "m" })).toEqual([
      { model: "m", workspace: "ws" },
    ]);
  });
});

describe("buildGroupPolicySpec", () => {
  it("always carries both lists, null when empty", () => {
    expect(buildGroupPolicySpec("Team", "sre", [{ model: "m" }], [])).toEqual({
      subject_kind: "Team",
      subject_name: "sre",
      allowed_models: [{ model: "m" }],
      denied_models: null,
    });
  });
});

describe("hasRules", () => {
  it("is false for no policy and for empty lists", () => {
    expect(hasRules(undefined)).toBe(false);
    expect(hasRules({ allowed_models: [], denied_models: null })).toBe(false);
    expect(
      hasRules({ allowed_models: null, denied_models: [{ model: "m" }] }),
    ).toBe(true);
  });
});
