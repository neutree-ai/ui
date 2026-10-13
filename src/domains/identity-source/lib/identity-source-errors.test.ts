import { describe, expect, it } from "vitest";
import {
  IDENTITY_SOURCE_ERROR_KEYS,
  identitySourceErrorMessage,
} from "./identity-source-errors";

const t = (key: string, options?: Record<string, unknown>) =>
  options?.hint ? `${key}|${options.hint}` : key;

describe("identitySourceErrorMessage", () => {
  it("maps every identity source code 10250-10259 and 10261-10264", () => {
    for (const code of [
      ...Array.from({ length: 10 }, (_, i) => 10250 + i),
      10261,
      10262,
      10263,
      10264,
    ]) {
      expect(IDENTITY_SOURCE_ERROR_KEYS[String(code)]).toMatch(
        /^identity_sources\.errors\./,
      );
    }
  });

  it("leaves the user profile code 10260 unmapped", () => {
    expect(IDENTITY_SOURCE_ERROR_KEYS["10260"]).toBeUndefined();
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

  it("translates neutree-api's own validation error (10261)", () => {
    expect(
      identitySourceErrorMessage(t, {
        code: "10261",
        message: "invalid identity source",
        hint: "spec.oidc.ca_cert holds no PEM certificate",
      }),
    ).toBe(
      "identity_sources.errors.invalid|spec.oidc.ca_cert holds no PEM certificate",
    );
  });

  it("explains a sync request on a source without sync (10264)", () => {
    expect(
      identitySourceErrorMessage(t, {
        code: "10264",
        message: "Sync is not enabled for this identity source",
      }),
    ).toBe("identity_sources.errors.syncNotEnabled");
  });

  it("leaves other errors to the caller", () => {
    expect(identitySourceErrorMessage(t, { code: "23505" })).toBeUndefined();
    expect(identitySourceErrorMessage(t, new Error("x"))).toBeUndefined();
    expect(identitySourceErrorMessage(t, undefined)).toBeUndefined();
  });
});
