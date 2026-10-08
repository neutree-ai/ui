import { describe, expect, it } from "vitest";
import {
  IDENTITY_SOURCE_ERROR_KEYS,
  identitySourceErrorMessage,
} from "./identity-source-errors";

const t = (key: string, options?: Record<string, unknown>) =>
  options?.hint ? `${key}|${options.hint}` : key;

describe("identitySourceErrorMessage", () => {
  it("maps every identity source code 10250-10260", () => {
    for (let code = 10250; code <= 10260; code++) {
      expect(IDENTITY_SOURCE_ERROR_KEYS[String(code)]).toMatch(
        /^identity_sources\.errors\./,
      );
    }
  });

  it("translates a database error and passes the hint on", () => {
    expect(
      identitySourceErrorMessage(t, {
        code: "10255",
        message: "spec.ldap.url is required",
        hint: "Provide spec.ldap.url",
      }),
    ).toBe("identity_sources.errors.fieldRequired|Provide spec.ldap.url");
  });

  it("translates neutree-api's own validation error (10260)", () => {
    expect(
      identitySourceErrorMessage(t, {
        code: "10260",
        message: "invalid identity source",
        hint: "spec.oidc.ca_cert holds no PEM certificate",
      }),
    ).toBe(
      "identity_sources.errors.invalid|spec.oidc.ca_cert holds no PEM certificate",
    );
  });

  it("leaves other errors to the caller", () => {
    expect(identitySourceErrorMessage(t, { code: "23505" })).toBeUndefined();
    expect(identitySourceErrorMessage(t, new Error("x"))).toBeUndefined();
    expect(identitySourceErrorMessage(t, undefined)).toBeUndefined();
  });
});
