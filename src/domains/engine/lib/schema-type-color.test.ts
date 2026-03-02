import { describe, expect, it } from "vitest";
import { getTypeColorClass } from "./schema-type-color";

describe("getTypeColorClass", () => {
  it("returns blue for object", () => {
    expect(getTypeColorClass("object")).toBe(
      "text-blue-500 dark:text-blue-400",
    );
  });

  it("returns purple for array", () => {
    expect(getTypeColorClass("array")).toBe(
      "text-purple-500 dark:text-purple-400",
    );
  });

  it("returns green for string", () => {
    expect(getTypeColorClass("string")).toBe(
      "text-green-500 dark:text-green-400",
    );
  });

  it("returns amber for integer", () => {
    expect(getTypeColorClass("integer")).toBe(
      "text-amber-500 dark:text-amber-400",
    );
  });

  it("returns amber for number", () => {
    expect(getTypeColorClass("number")).toBe(
      "text-amber-500 dark:text-amber-400",
    );
  });

  it("returns empty string for boolean", () => {
    expect(getTypeColorClass("boolean")).toBe("");
  });

  it("returns muted foreground for unknown type", () => {
    expect(getTypeColorClass("unknown")).toBe("text-muted-foreground");
    expect(getTypeColorClass("any")).toBe("text-muted-foreground");
  });
});
