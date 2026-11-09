import { describe, expect, it } from "vitest";
import { serviceAccountKeyErrorMessage } from "./create-api-key-error";

const t = (key: string) => key;

describe("serviceAccountKeyErrorMessage", () => {
  it.each([
    ["10044", "api_keys.serviceAccount.errors.workspace"],
    ["10317", "service_accounts.errors.inactive"],
  ])("translates %s", (code, key) => {
    expect(serviceAccountKeyErrorMessage(t, { code }, "fallback")).toBe(key);
  });

  it("falls back to the server text, then to the fallback", () => {
    expect(
      serviceAccountKeyErrorMessage(t, { message: { message: "x" } }, "f"),
    ).toBe("x");
    expect(serviceAccountKeyErrorMessage(t, {}, "fallback")).toBe("fallback");
  });
});
