import { describe, expect, it } from "vitest";
import {
  getApiErrorCode,
  getApiErrorHint,
  translateApiError,
} from "./api-error-code";

describe("api-error-code", () => {
  it("reads string and numeric codes", () => {
    expect(getApiErrorCode({ code: "10260" })).toBe("10260");
    expect(getApiErrorCode({ code: 10260 })).toBe("10260");
    expect(getApiErrorCode({ code: "" })).toBeUndefined();
    expect(getApiErrorCode("10260")).toBeUndefined();
    expect(getApiErrorCode(null)).toBeUndefined();
  });

  it("reads the hint", () => {
    expect(getApiErrorHint({ hint: " fix it " })).toBe("fix it");
    expect(getApiErrorHint({})).toBe("");
  });

  it("translates only the codes of the given table", () => {
    const t = (key: string, o?: Record<string, unknown>) =>
      `${key}:${o?.hint ?? ""}`;
    const table = { "10260": "user_profiles.errors.externalEmailReadOnly" };
    expect(translateApiError(t, { code: "10260", hint: "h" }, table)).toBe(
      "user_profiles.errors.externalEmailReadOnly:h",
    );
    expect(translateApiError(t, { code: "10255" }, table)).toBeUndefined();
  });
});
