import { describe, expect, it } from "vitest";
import { isExceptionalEnginePhase } from "./engine-phase";

describe("isExceptionalEnginePhase", () => {
  it("hides the steady phase", () => {
    expect(isExceptionalEnginePhase("Created")).toBe(false);
  });

  it("shows phases that need attention", () => {
    expect(isExceptionalEnginePhase("Pending")).toBe(true);
    expect(isExceptionalEnginePhase("Failed")).toBe(true);
    expect(isExceptionalEnginePhase("Deleted")).toBe(true);
  });

  it("shows nothing when the engine has no phase yet", () => {
    expect(isExceptionalEnginePhase(undefined)).toBe(false);
    expect(isExceptionalEnginePhase(null)).toBe(false);
    expect(isExceptionalEnginePhase("")).toBe(false);
  });
});
