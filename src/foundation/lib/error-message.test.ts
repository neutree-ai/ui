import { describe, expect, it } from "vitest";
import { getErrorMessage } from "./error-message";

describe("getErrorMessage", () => {
  it("should read the message off an Error", () => {
    expect(getErrorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("should read the message off a plain object such as Refine's HttpError", () => {
    expect(
      getErrorMessage(
        { message: "spec must be a mapping", statusCode: 400 },
        "fallback",
      ),
    ).toBe("spec must be a mapping");
  });

  it("should return a thrown string as-is", () => {
    expect(getErrorMessage("boom", "fallback")).toBe("boom");
  });

  it("should trim surrounding whitespace", () => {
    expect(getErrorMessage({ message: "  boom  " }, "fallback")).toBe("boom");
  });

  it("should fall back when the object carries no usable message", () => {
    expect(getErrorMessage({ statusCode: 500 }, "fallback")).toBe("fallback");
    expect(getErrorMessage(new Error(""), "fallback")).toBe("fallback");
    expect(getErrorMessage({ message: "   " }, "fallback")).toBe("fallback");
    expect(getErrorMessage({ message: 42 }, "fallback")).toBe("fallback");
  });

  it("should fall back for values with no message at all", () => {
    expect(getErrorMessage(null, "fallback")).toBe("fallback");
    expect(getErrorMessage(undefined, "fallback")).toBe("fallback");
    expect(getErrorMessage(42, "fallback")).toBe("fallback");
    expect(getErrorMessage("", "fallback")).toBe("fallback");
  });
});
