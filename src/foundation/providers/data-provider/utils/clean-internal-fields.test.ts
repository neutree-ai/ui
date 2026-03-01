import { describe, expect, it } from "vitest";
import { cleanInternalFields } from "./clean-internal-fields";

describe("cleanInternalFields", () => {
  it("removes keys starting with '-'", () => {
    const variables = { name: "test", "-internal": true, "-flag": 1 };
    cleanInternalFields(variables);
    expect(variables).toEqual({ name: "test" });
  });

  it("keeps all keys when none start with '-'", () => {
    const variables = { name: "test", count: 3 };
    cleanInternalFields(variables);
    expect(variables).toEqual({ name: "test", count: 3 });
  });

  it("handles empty object", () => {
    const variables = {};
    cleanInternalFields(variables);
    expect(variables).toEqual({});
  });

  it("removes all keys when all start with '-'", () => {
    const variables = { "-a": 1, "-b": 2 };
    cleanInternalFields(variables);
    expect(variables).toEqual({});
  });
});
