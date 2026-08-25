import { describe, expect, it } from "vitest";
import { apiKeyActionErrorMessage } from "./create-api-key-error";

const FALLBACK = "Failed to create API key. Please try again.";

describe("apiKeyActionErrorMessage", () => {
  it("extracts a nested structured message instead of rendering an object", () => {
    expect(
      apiKeyActionErrorMessage(
        { message: { message: "Project is disabled" } },
        FALLBACK,
      ),
    ).toBe("Project is disabled");
  });

  it("preserves a move error returned as a nested object", () => {
    expect(
      apiKeyActionErrorMessage(
        { message: { message: "Target Project is disabled" } },
        "Failed to move API keys. Please try again.",
      ),
    ).toBe("Target Project is disabled");
  });

  it("unwraps an Error instance", () => {
    expect(apiKeyActionErrorMessage(new Error("boom"), FALLBACK)).toBe("boom");
  });

  it("uses the supplied fallback for unknown errors", () => {
    expect(apiKeyActionErrorMessage({ reason: "unknown" }, FALLBACK)).toBe(
      FALLBACK,
    );
  });

  it("uses the fallback when the message is an empty string", () => {
    expect(apiKeyActionErrorMessage({ message: "" }, FALLBACK)).toBe(FALLBACK);
  });
});
