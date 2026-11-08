import { describe, expect, it } from "vitest";
import { serviceAccountErrorMessage } from "./errors";

const t = (key: string) => key;

describe("serviceAccountErrorMessage", () => {
  it("explains a management role refused in application permissions", () => {
    expect(serviceAccountErrorMessage(t, { code: "10325" }, "fallback")).toBe(
      "service_accounts.errors.managementRole",
    );
  });

  it("falls back to the server text, then to the fallback", () => {
    expect(
      serviceAccountErrorMessage(t, { code: "42501", message: "denied" }, "x"),
    ).toBe("denied");
    expect(serviceAccountErrorMessage(t, {}, "fallback")).toBe("fallback");
  });
});
