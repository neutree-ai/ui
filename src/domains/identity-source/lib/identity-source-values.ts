import type {
  IdentitySource,
  IdentitySourceLDAPSpec,
  IdentitySourceLDAPSyncSpec,
  IdentitySourceOIDCSpec,
  IdentitySourceSpec,
  IdentitySourceSyncSpec,
} from "@/domains/identity-source/types";
import type { Metadata } from "@/foundation/types/basic-types";

// Rules mirrored from the backend (api/v1/identity_source_types.go and the
// identity_sources write trigger). The server stays the authority; these only
// let the form say what is wrong before a round trip.

const IDENTITY_SOURCE_NAME_PATTERN = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/;
const LDAP_USERNAME_PLACEHOLDER = "{username}";
const OIDC_SCOPE_OPENID = "openid";
const DEFAULT_OIDC_SCOPES = ["openid", "profile", "email"];
const DEFAULT_LDAP_TIMEOUT_SECONDS = 10;
const OIDC_CALLBACK_PATH = "/auth/oidc/callback";
export const DEFAULT_SYNC_INTERVAL_SECONDS = 3600;
const MIN_SYNC_INTERVAL_SECONDS = 60;

const PEM_CERTIFICATE_MARKER = "-----BEGIN CERTIFICATE-----";

export const isValidIdentitySourceName = (name: string): boolean =>
  IDENTITY_SOURCE_NAME_PATTERN.test(name);

export const isLdapUrl = (value: string): boolean =>
  /^ldaps?:\/\/[^/?#\s]+/i.test(value.trim());

export const isLdapsUrl = (value: string): boolean =>
  /^ldaps:\/\//i.test(value.trim());

export const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value.trim());
    return (
      (url.protocol === "http:" || url.protocol === "https:") && !!url.host
    );
  } catch {
    return false;
  }
};

/** An allowed OIDC redirect: absolute http(s), no user info, query or fragment. */
export const isAllowedRedirectUrl = (value: string): boolean => {
  const raw = value.trim();
  if (!isHttpUrl(raw) || /[?#@]/.test(raw)) {
    return false;
  }
  return true;
};

export const hasUsernamePlaceholder = (filter: string): boolean =>
  filter.includes(LDAP_USERNAME_PLACEHOLDER);

/** Empty means "use the defaults", which include openid. */
export const scopesIncludeOpenid = (scopes: string[]): boolean => {
  const cleaned = cleanList(scopes);
  return cleaned.length === 0 || cleaned.includes(OIDC_SCOPE_OPENID);
};

/** Empty is fine (system trust store); otherwise it must hold a PEM certificate. */
export const isPemBundleOrEmpty = (value: string | null | undefined): boolean =>
  !value?.trim() || value.includes(PEM_CERTIFICATE_MARKER);

const isBlank = (value: unknown): boolean =>
  value === "" || value === null || value === undefined;

/** Empty (the default, one hour) or a whole number of seconds, at least 60. */
export const isValidSyncInterval = (value: unknown): boolean =>
  isBlank(value) ||
  (Number.isInteger(Number(value)) &&
    Number(value) >= MIN_SYNC_INTERVAL_SECONDS);

/** Empty or 0 (the default) or a positive whole number. */
export const isValidPageSize = (value: unknown): boolean =>
  isBlank(value) || (Number.isInteger(Number(value)) && Number(value) >= 0);

const cleanList = (values: string[] | null | undefined): string[] =>
  (values ?? []).map((v) => v.trim()).filter(Boolean);

/** The public URL of neutree-api's OIDC callback, given the REST base URL. */
export const defaultOidcRedirectUrl = (restUrl: string): string =>
  `${restUrl.replace(/\/$/, "")}${OIDC_CALLBACK_PATH}`;

const defaultLdapSpec = (): IdentitySourceLDAPSpec => ({
  url: "",
  start_tls: false,
  ca_cert: "",
  insecure_skip_verify: false,
  timeout: DEFAULT_LDAP_TIMEOUT_SECONDS,
  bind_dn: "",
  bind_password: "",
  user_base_dn: "",
  user_filter: "(uid={username})",
  attributes: {
    id: "entryUUID",
    username: "uid",
    email: "mail",
    display_name: "cn",
    member_of: "",
  },
});

const LDAP_SYNC_TEXT_FIELDS = [
  "org_unit_base_dn",
  "org_unit_filter",
  "org_unit_name_attribute",
  "group_base_dn",
  "group_filter",
  "group_name_attribute",
  "group_member_attribute",
  "user_list_filter",
  "disabled_user_filter",
] as const;

type LdapSyncFormValues = Record<
  (typeof LDAP_SYNC_TEXT_FIELDS)[number],
  string
> & { page_size: number | string };

// Blank fields take the server defaults, shown as placeholders in the form.
const defaultLdapSyncValues = (): LdapSyncFormValues => ({
  org_unit_base_dn: "",
  org_unit_filter: "",
  org_unit_name_attribute: "",
  group_base_dn: "",
  group_filter: "",
  group_name_attribute: "",
  group_member_attribute: "",
  user_list_filter: "",
  disabled_user_filter: "",
  page_size: "",
});

type SyncFormValues = {
  enabled: boolean;
  interval: number | string;
  requested_at?: string | null;
};

const defaultSyncValues = (): SyncFormValues => ({
  enabled: false,
  interval: DEFAULT_SYNC_INTERVAL_SECONDS,
});

const defaultOidcSpec = (
  restUrl: string,
  uiRootUrl: string,
): IdentitySourceOIDCSpec => ({
  issuer: "",
  client_id: "",
  client_secret: "",
  scopes: [...DEFAULT_OIDC_SCOPES],
  ca_cert: "",
  redirect_url: defaultOidcRedirectUrl(restUrl),
  claims: {
    username: "preferred_username",
    display_name: "name",
    email: "email",
  },
  allowed_redirects: [uiRootUrl],
});

export type IdentitySourceFormValues = {
  metadata: Partial<Metadata> & { name: string; display_name?: string | null };
  spec: {
    type: IdentitySourceSpec["type"];
    enabled: boolean;
    ldap: Omit<IdentitySourceLDAPSpec, "sync"> & { sync: LdapSyncFormValues };
    oidc: IdentitySourceOIDCSpec;
    sync: SyncFormValues;
  };
};

export const createFormDefaults = (
  restUrl: string,
  uiRootUrl: string,
): IdentitySourceFormValues => ({
  metadata: { name: "", display_name: "" },
  spec: {
    type: "ldap",
    enabled: true,
    ldap: { ...defaultLdapSpec(), sync: defaultLdapSyncValues() },
    oidc: defaultOidcSpec(restUrl, uiRootUrl),
    sync: defaultSyncValues(),
  },
});

const withoutNulls = <T extends object>(
  defaults: T,
  value?: object | null,
): T => {
  const out = { ...defaults } as Record<string, unknown>;
  for (const [key, v] of Object.entries(value ?? {})) {
    if (v !== null && v !== undefined) {
      out[key] = v;
    }
  }
  return out as T;
};

/**
 * A stored source as the edit form holds it: both sub-objects present (the
 * unused one with defaults) and the write-only secrets blank, since reads
 * never return them.
 */
export const toFormValues = (
  record: IdentitySource,
  restUrl: string,
  uiRootUrl: string,
): IdentitySourceFormValues => {
  const ldapDefaults = defaultLdapSpec();
  const oidcDefaults = defaultOidcSpec(restUrl, uiRootUrl);
  const ldap = withoutNulls(ldapDefaults, record.spec?.ldap);
  const oidc = withoutNulls(oidcDefaults, record.spec?.oidc);
  return {
    metadata: {
      ...record.metadata,
      display_name: record.metadata?.display_name ?? "",
    },
    spec: {
      type: record.spec?.type ?? "ldap",
      enabled: record.spec?.enabled ?? false,
      ldap: {
        ...ldap,
        bind_password: "",
        attributes: withoutNulls(
          ldapDefaults.attributes ?? {},
          record.spec?.ldap?.attributes,
        ),
        sync: withoutNulls(defaultLdapSyncValues(), record.spec?.ldap?.sync),
      },
      oidc: {
        ...oidc,
        client_secret: "",
        claims: withoutNulls(
          oidcDefaults.claims ?? {},
          record.spec?.oidc?.claims,
        ),
      },
      sync: withoutNulls(defaultSyncValues(), record.spec?.sync),
    },
  };
};

const toSyncSpec = (sync: SyncFormValues): IdentitySourceSyncSpec => ({
  enabled: sync.enabled === true,
  interval: isBlank(sync.interval)
    ? DEFAULT_SYNC_INTERVAL_SECONDS
    : Number(sync.interval),
  // Carried over so a save does not drop a sync request still waiting to run.
  requested_at: sync.requested_at ?? null,
});

const toLdapSyncSpec = (
  sync: LdapSyncFormValues,
): IdentitySourceLDAPSyncSpec => {
  const out: IdentitySourceLDAPSyncSpec = {
    page_size: isBlank(sync.page_size) ? null : Number(sync.page_size),
  };
  for (const field of LDAP_SYNC_TEXT_FIELDS) {
    out[field] = sync[field]?.trim() ?? "";
  }
  return out;
};

type IdentitySourcePayload = {
  api_version?: "v1";
  kind?: "IdentitySource";
  metadata: Partial<Metadata>;
  spec: IdentitySourceSpec;
};

/**
 * What the form sends. Only the sub-object of the chosen type goes out, list
 * inputs are trimmed of blanks, and a secret left blank is not sent at all —
 * on edit that keeps the stored one (create requires it in the form). An OIDC
 * source sends no sync, which keeps the stored one.
 */
export const toIdentitySourcePayload = (
  values: IdentitySourceFormValues,
  action: "create" | "edit",
): IdentitySourcePayload => {
  const { type, enabled } = values.spec;
  const spec: IdentitySourceSpec = { type, enabled, ldap: null, oidc: null };

  if (type === "ldap") {
    const { bind_password, sync: ldapSync, ...ldap } = values.spec.ldap;
    const timeout = Number(ldap.timeout);
    // Sent whole, even when sync is off, so turning it off keeps the settings.
    spec.sync = toSyncSpec(values.spec.sync);
    spec.ldap = {
      ...ldap,
      sync: toLdapSyncSpec(ldapSync),
      url: ldap.url.trim(),
      timeout: Number.isFinite(timeout)
        ? timeout
        : DEFAULT_LDAP_TIMEOUT_SECONDS,
      ca_cert: ldap.ca_cert?.trim() ?? "",
      ...(bind_password ? { bind_password } : {}),
    };
  } else {
    const { client_secret, ...oidc } = values.spec.oidc;
    spec.oidc = {
      ...oidc,
      issuer: oidc.issuer.trim(),
      redirect_url: oidc.redirect_url.trim(),
      scopes: cleanList(oidc.scopes),
      allowed_redirects: cleanList(oidc.allowed_redirects),
      ca_cert: oidc.ca_cert?.trim() ?? "",
      ...(client_secret ? { client_secret } : {}),
    };
  }

  const displayName = values.metadata.display_name?.trim() ?? "";

  if (action === "create") {
    return {
      api_version: "v1",
      kind: "IdentitySource",
      metadata: {
        name: values.metadata.name.trim(),
        display_name: displayName,
      },
      spec,
    };
  }

  // PostgREST replaces the whole metadata composite on PATCH: send all of it.
  return {
    metadata: { ...values.metadata, display_name: displayName },
    spec,
  };
};
