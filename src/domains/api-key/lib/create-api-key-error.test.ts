import { describe, expect, it } from "vitest";
import { apiKeyActionErrorMessage } from "./create-api-key-error";

const FALLBACK = "Failed to create API key. Please try again.";

describe("apiKeyActionErrorMessage", () => {
  it.each([
    [
      "a nested structured message",
      { message: { message: "Disabled" } },
      "Disabled",
    ],
    ["an Error instance", new Error("boom"), "boom"],
    ["an unknown error", { reason: "unknown" }, FALLBACK],
    ["an empty message", { message: "" }, FALLBACK],
  ])("reads %s", (_case, error, message) => {
    expect(apiKeyActionErrorMessage(error, FALLBACK)).toBe(message);
  });
});
