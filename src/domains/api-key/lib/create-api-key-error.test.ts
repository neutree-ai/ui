import { describe, expect, it } from "vitest";
import {
  apiKeyActionErrorMessage,
  createApiKeyErrorMessage,
} from "./create-api-key-error";

describe("createApiKeyErrorMessage", () => {
  it("extracts a nested structured message instead of rendering an object", () => {
    expect(
      createApiKeyErrorMessage({ message: { message: "Project is disabled" } }),
    ).toBe("Project is disabled");
  });

  it("preserves a move error returned as a nested object", () => {
    expect(
      apiKeyActionErrorMessage(
        {
          message: {
            message: "Target Project is disabled",
          },
        },
        "Failed to move API keys. Please try again.",
      ),
    ).toBe("Target Project is disabled");
  });

  it("uses the supplied action fallback", () => {
    expect(
      apiKeyActionErrorMessage(
        { reason: "unknown" },
        "Failed to move API keys. Please try again.",
      ),
    ).toBe("Failed to move API keys. Please try again.");
  });

  it("uses a stable fallback for unknown errors", () => {
    expect(createApiKeyErrorMessage({ reason: "unknown" })).toBe(
      "Failed to create API key. Please try again.",
    );
  });
});
