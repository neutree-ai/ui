import { describe, expect, it } from "vitest";
import type { IdentitySource } from "@/domains/identity-source/types";
import {
  createFormDefaults,
  defaultOidcRedirectUrl,
  hasUsernamePlaceholder,
  type IdentitySourceFormValues,
  isAllowedRedirectUrl,
  isHttpUrl,
  isLdapUrl,
  isPemBundleOrEmpty,
  isValidIdentitySourceName,
  scopesIncludeOpenid,
  toFormValues,
  toIdentitySourcePayload,
} from "./identity-source-values";

const REST = "https://neutree.example.org/api/v1";
const UI = "https://neutree.example.org/";

const ldapValues = (
  patch: Partial<IdentitySourceFormValues["spec"]["ldap"]> = {},
): IdentitySourceFormValues => {
  const values = createFormDefaults(REST, UI);
  values.metadata = { name: "corp-ldap", display_name: " Corp " };
  values.spec.ldap = {
    ...values.spec.ldap,
    url: " ldaps://ldap.example.org:636 ",
    bind_dn: "cn=svc,dc=example,dc=org",
    user_base_dn: "ou=people,dc=example,dc=org",
    ...patch,
  };
  return values;
};

describe("validators mirror the server rules", () => {
  it("names are DNS labels of at most 32 characters", () => {
    expect(isValidIdentitySourceName("corp-ldap")).toBe(true);
    expect(isValidIdentitySourceName("a".repeat(32))).toBe(true);
    expect(isValidIdentitySourceName("a".repeat(33))).toBe(false);
    expect(isValidIdentitySourceName("corp.ldap")).toBe(false);
    expect(isValidIdentitySourceName("-corp")).toBe(false);
    expect(isValidIdentitySourceName("Corp")).toBe(false);
  });

  it("LDAP URLs need an ldap or ldaps scheme and a host", () => {
    expect(isLdapUrl("ldap://ldap.example.org:389")).toBe(true);
    expect(isLdapUrl("LDAPS://ldap.example.org")).toBe(true);
    expect(isLdapUrl("http://ldap.example.org")).toBe(false);
    expect(isLdapUrl("ldap://")).toBe(false);
  });

  it("http URLs need an http(s) scheme and a host", () => {
    expect(isHttpUrl("https://idp.example.org/realms/x")).toBe(true);
    expect(isHttpUrl("ftp://idp.example.org")).toBe(false);
    expect(isHttpUrl("idp.example.org")).toBe(false);
  });

  it("allowed redirects refuse user info, query and fragment", () => {
    expect(isAllowedRedirectUrl("https://neutree.example.org/")).toBe(true);
    expect(isAllowedRedirectUrl("https://neutree.example.org/#/x")).toBe(false);
    expect(isAllowedRedirectUrl("https://neutree.example.org/?a=1")).toBe(
      false,
    );
    expect(isAllowedRedirectUrl("https://u@neutree.example.org/")).toBe(false);
  });

  it("the user filter must contain {username}", () => {
    expect(hasUsernamePlaceholder("(uid={username})")).toBe(true);
    expect(hasUsernamePlaceholder("(uid=*)")).toBe(false);
  });

  it("scopes must include openid unless left empty", () => {
    expect(scopesIncludeOpenid(["openid", "email"])).toBe(true);
    expect(scopesIncludeOpenid(["", " "])).toBe(true);
    expect(scopesIncludeOpenid(["profile", "email"])).toBe(false);
  });

  it("a CA bundle is empty or PEM", () => {
    expect(isPemBundleOrEmpty("")).toBe(true);
    expect(isPemBundleOrEmpty(null)).toBe(true);
    expect(isPemBundleOrEmpty("-----BEGIN CERTIFICATE-----\nAA==")).toBe(true);
    expect(isPemBundleOrEmpty("junk")).toBe(false);
  });
});

describe("createFormDefaults", () => {
  it("matches the backend defaults and points OIDC at this deployment", () => {
    const values = createFormDefaults(REST, UI);
    expect(values.spec.type).toBe("ldap");
    expect(values.spec.ldap.timeout).toBe(10);
    expect(values.spec.ldap.user_filter).toContain("{username}");
    expect(values.spec.ldap.attributes).toMatchObject({
      id: "entryUUID",
      username: "uid",
      email: "mail",
      display_name: "cn",
    });
    expect(values.spec.oidc.scopes).toEqual(["openid", "profile", "email"]);
    expect(values.spec.oidc.redirect_url).toBe(
      "https://neutree.example.org/api/v1/auth/oidc/callback",
    );
    expect(values.spec.oidc.allowed_redirects).toEqual([UI]);
    expect(defaultOidcRedirectUrl(`${REST}/`)).toBe(
      `${REST}/auth/oidc/callback`,
    );
  });
});

describe("toIdentitySourcePayload", () => {
  it("sends only the chosen type's settings, trimmed", () => {
    const payload = toIdentitySourcePayload(
      ldapValues({ bind_password: "s3cret" }),
      "create",
    );
    expect(payload).toMatchObject({
      api_version: "v1",
      kind: "IdentitySource",
      metadata: { name: "corp-ldap", display_name: "Corp" },
    });
    expect(payload.spec.oidc).toBeNull();
    expect(payload.spec.ldap?.url).toBe("ldaps://ldap.example.org:636");
    expect(payload.spec.ldap?.bind_password).toBe("s3cret");
  });

  it("does not send a secret left blank on edit", () => {
    const values = ldapValues({ bind_password: "" });
    values.metadata = {
      ...values.metadata,
      labels: { a: "b" },
      creation_timestamp: "2026-10-01T00:00:00Z",
    };
    const payload = toIdentitySourcePayload(values, "edit");
    expect(payload.spec.ldap).not.toHaveProperty("bind_password");
    // the whole metadata composite goes back, not just the edited field
    expect(payload.metadata).toMatchObject({
      name: "corp-ldap",
      labels: { a: "b" },
      creation_timestamp: "2026-10-01T00:00:00Z",
    });
    expect(payload).not.toHaveProperty("api_version");
  });

  it("sends a secret that was filled in on edit", () => {
    const payload = toIdentitySourcePayload(
      ldapValues({ bind_password: "new" }),
      "edit",
    );
    expect(payload.spec.ldap?.bind_password).toBe("new");
  });

  it("cleans OIDC list inputs and drops a blank client secret", () => {
    const values = createFormDefaults(REST, UI);
    values.metadata = { name: "kc" };
    values.spec.type = "oidc";
    values.spec.oidc = {
      ...values.spec.oidc,
      issuer: "https://kc.example.org/realms/neutree ",
      client_id: "neutree",
      client_secret: "",
      scopes: ["openid", "", "email", ""],
      allowed_redirects: [" https://a.example.org/ ", "", "https://b/"],
    };
    const payload = toIdentitySourcePayload(values, "edit");
    expect(payload.spec.ldap).toBeNull();
    expect(payload.spec.oidc).not.toHaveProperty("client_secret");
    expect(payload.spec.oidc?.issuer).toBe(
      "https://kc.example.org/realms/neutree",
    );
    expect(payload.spec.oidc?.scopes).toEqual(["openid", "email"]);
    expect(payload.spec.oidc?.allowed_redirects).toEqual([
      "https://a.example.org/",
      "https://b/",
    ]);
  });
});

describe("toFormValues", () => {
  it("blanks secrets and fills the unused type with defaults", () => {
    const record = {
      id: 1,
      api_version: "v1",
      kind: "IdentitySource",
      metadata: { name: "corp-ldap", display_name: "" },
      spec: {
        type: "ldap",
        enabled: true,
        ldap: {
          url: "ldaps://x",
          bind_dn: "cn=svc",
          bind_password: null,
          user_base_dn: "ou=p",
          user_filter: "(uid={username})",
          ca_cert: null,
          attributes: { id: "uuid", member_of: null },
        },
        oidc: null,
      },
    } as unknown as IdentitySource;
    const values = toFormValues(record, REST, UI);
    expect(values.spec.ldap.bind_password).toBe("");
    expect(values.spec.ldap.ca_cert).toBe("");
    expect(values.spec.ldap.attributes).toMatchObject({
      id: "uuid",
      username: "uid",
      member_of: "",
    });
    expect(values.spec.oidc.client_secret).toBe("");
    expect(values.spec.oidc.redirect_url).toBe(`${REST}/auth/oidc/callback`);
  });
});
