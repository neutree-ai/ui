import type {
  IdentitySource,
  IdentitySourceLDAPSpec,
  IdentitySourceOIDCSpec,
  IdentitySourceSpec,
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
    ldap: IdentitySourceLDAPSpec;
    oidc: IdentitySourceOIDCSpec;
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
    ldap: defaultLdapSpec(),
    oidc: defaultOidcSpec(restUrl, uiRootUrl),
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
      },
      oidc: {
        ...oidc,
        client_secret: "",
        claims: withoutNulls(
          oidcDefaults.claims ?? {},
          record.spec?.oidc?.claims,
        ),
      },
    },
  };
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
 * on edit that keeps the stored one (create requires it in the form).
 */
export const toIdentitySourcePayload = (
  values: IdentitySourceFormValues,
  action: "create" | "edit",
): IdentitySourcePayload => {
  const { type, enabled } = values.spec;
  const spec: IdentitySourceSpec = { type, enabled, ldap: null, oidc: null };

  if (type === "ldap") {
    const { bind_password, ...ldap } = values.spec.ldap;
    const timeout = Number(ldap.timeout);
    spec.ldap = {
      ...ldap,
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
