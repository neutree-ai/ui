import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/api", () => ({ REST_URL: "http://h/api/v1" }));

import {
  buildOidcAuthorizeUrl,
  normalizeLoginIdentitySources,
} from "./identity-sources";

describe("normalizeLoginIdentitySources", () => {
  it("keeps well-formed sources and defaults the display name", () => {
    expect(
      normalizeLoginIdentitySources([
        { name: "corp-ldap", display_name: "Corp LDAP", type: "ldap" },
        { name: "keycloak", display_name: "", type: "oidc" },
        { name: "saml", display_name: "SAML", type: "saml" },
        { display_name: "nameless", type: "ldap" },
        null,
      ]),
    ).toEqual([
      { name: "corp-ldap", display_name: "Corp LDAP", type: "ldap" },
      { name: "keycloak", display_name: "keycloak", type: "oidc" },
    ]);
  });

  it("treats a non-list answer as no sources", () => {
    expect(normalizeLoginIdentitySources(undefined)).toEqual([]);
    expect(normalizeLoginIdentitySources({ error: "x" })).toEqual([]);
  });
});

describe("buildOidcAuthorizeUrl", () => {
  it("names the source and the return address", () => {
    const url = new URL(buildOidcAuthorizeUrl("keycloak", "http://h:3000/"));
    expect(`${url.origin}${url.pathname}`).toBe(
      "http://h/api/v1/auth/oidc/authorize",
    );
    expect(url.searchParams.get("source")).toBe("keycloak");
    expect(url.searchParams.get("redirect_to")).toBe("http://h:3000/");
  });
});
