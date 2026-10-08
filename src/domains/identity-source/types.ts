import type { Metadata } from "@/foundation/types/basic-types";

export type IdentitySourceType = "ldap" | "oidc";

export type IdentitySourcePhase =
  | "Pending"
  | "Connected"
  | "Failed"
  | "Deleted";

export type IdentitySourceLDAPAttributes = {
  id?: string | null;
  username?: string | null;
  email?: string | null;
  display_name?: string | null;
  member_of?: string | null;
};

export type IdentitySourceLDAPSpec = {
  url: string;
  start_tls?: boolean | null;
  ca_cert?: string | null;
  insecure_skip_verify?: boolean | null;
  timeout?: number | null;
  bind_dn: string;
  /** Write-only: always null in reads; empty on a write keeps the stored one. */
  bind_password?: string | null;
  user_base_dn: string;
  user_filter: string;
  attributes?: IdentitySourceLDAPAttributes | null;
};

export type IdentitySourceOIDCClaims = {
  username?: string | null;
  display_name?: string | null;
  email?: string | null;
};

export type IdentitySourceOIDCSpec = {
  issuer: string;
  client_id: string;
  /** Write-only, like IdentitySourceLDAPSpec.bind_password. */
  client_secret?: string | null;
  scopes?: string[] | null;
  ca_cert?: string | null;
  redirect_url: string;
  claims?: IdentitySourceOIDCClaims | null;
  allowed_redirects: string[];
};

export type IdentitySourceSpec = {
  type: IdentitySourceType;
  enabled: boolean;
  ldap?: IdentitySourceLDAPSpec | null;
  oidc?: IdentitySourceOIDCSpec | null;
};

export type IdentitySourceConnectionTest = {
  time?: string | null;
  ok: boolean;
  message?: string | null;
};

export type IdentitySourceStatus = {
  phase?: IdentitySourcePhase | null;
  last_transition_time?: string | null;
  error_message?: string | null;
  last_connection_test?: IdentitySourceConnectionTest | null;
};

export type IdentitySource = {
  id: number;
  api_version: "v1";
  kind: "IdentitySource";
  metadata: Metadata;
  spec: IdentitySourceSpec;
  status?: IdentitySourceStatus | null;
};
