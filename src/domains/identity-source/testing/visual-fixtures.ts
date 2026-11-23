import type { IdentitySource } from "@/domains/identity-source/types";
import { fixtureMetadata } from "@/foundation/testing/visual-fixtures";

/** A connected OIDC source with several scopes and a passing test. */
export const oidcSource: IdentitySource = {
  id: 1,
  api_version: "v1",
  kind: "IdentitySource",
  metadata: fixtureMetadata("corp-sso", { display_name: "Corporate SSO" }),
  spec: {
    type: "oidc",
    enabled: true,
    oidc: {
      issuer: "https://idp.example.com/realms/main",
      client_id: "neutree-ui",
      scopes: ["openid", "profile", "email", "groups"],
      redirect_url: "https://neutree.example.com/callback",
      claims: { username: "preferred_username", email: "email" },
      allowed_redirects: ["https://neutree.example.com/"],
    },
  },
  status: {
    phase: "Connected",
    last_transition_time: "2026-05-30T10:00:00Z",
    last_connection_test: {
      time: "2026-06-01T11:00:00Z",
      ok: true,
      message: "discovery document fetched",
    },
  },
};

/** An LDAP source with a whitespace display name, empty optional fields and a failed untimed test. */
export const ldapSource: IdentitySource = {
  id: 2,
  api_version: "v1",
  kind: "IdentitySource",
  metadata: fixtureMetadata("office-ldap", { display_name: "   " }),
  spec: {
    type: "ldap",
    enabled: false,
    ldap: {
      url: "ldaps://ldap.example.com:636",
      start_tls: null,
      ca_cert: null,
      timeout: null,
      bind_dn: "cn=reader,dc=example,dc=com",
      user_base_dn: "ou=people,dc=example,dc=com",
      user_filter: "(uid=%s)",
      attributes: null,
    },
    sync: { enabled: false, interval: null },
  },
  status: {
    phase: "Failed",
    error_message: "bind failed",
    last_transition_time: "2026-05-31T22:00:00Z",
    last_connection_test: { ok: false, message: "LDAP Result Code 49" },
  },
};

/** A source nobody has tested yet. */
export const untestedOidcSource: IdentitySource = {
  ...oidcSource,
  id: 3,
  metadata: fixtureMetadata("staging-sso"),
  spec: {
    ...oidcSource.spec,
    oidc: oidcSource.spec.oidc && { ...oidcSource.spec.oidc, scopes: null },
  },
  status: { phase: "Pending", last_transition_time: "2026-06-01T10:00:00Z" },
};
