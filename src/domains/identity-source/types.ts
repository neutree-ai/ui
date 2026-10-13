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
  /** Kept as stored when a write leaves it out. */
  sync?: IdentitySourceLDAPSyncSpec | null;
};

/** Where the organization sync finds departments, groups and users. */
export type IdentitySourceLDAPSyncSpec = {
  org_unit_base_dn?: string | null;
  org_unit_filter?: string | null;
  org_unit_name_attribute?: string | null;
  group_base_dn?: string | null;
  group_filter?: string | null;
  group_name_attribute?: string | null;
  group_member_attribute?: string | null;
  user_list_filter?: string | null;
  disabled_user_filter?: string | null;
  page_size?: number | null;
};

export type IdentitySourceSyncSpec = {
  enabled: boolean;
  /** Seconds; at least 60, empty means 3600. */
  interval?: number | null;
  /** Set by request_identity_source_sync; a later value asks for a sync now. */
  requested_at?: string | null;
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
  /** Organization sync; only LDAP sources sync. Kept as stored when a write leaves it out. */
  sync?: IdentitySourceSyncSpec | null;
};

export type IdentitySourceConnectionTest = {
  time?: string | null;
  ok: boolean;
  message?: string | null;
};

export type IdentitySourceSyncStatus = {
  /** The spec.sync.requested_at this sync handled. */
  requested_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  ok: boolean;
  message?: string | null;
  last_success_time?: string | null;
  created?: number | null;
  updated?: number | null;
  reactivated?: number | null;
  deactivated?: number | null;
  memberships?: number | null;
  /** Planned writes a failed sync did not apply. */
  pending?: number | null;
};

export type IdentitySourceStatus = {
  phase?: IdentitySourcePhase | null;
  last_transition_time?: string | null;
  error_message?: string | null;
  last_connection_test?: IdentitySourceConnectionTest | null;
  last_sync?: IdentitySourceSyncStatus | null;
};

export type IdentitySource = {
  id: number;
  api_version: "v1";
  kind: "IdentitySource";
  metadata: Metadata;
  spec: IdentitySourceSpec;
  status?: IdentitySourceStatus | null;
};
