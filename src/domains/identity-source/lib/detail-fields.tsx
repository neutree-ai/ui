import type { TFunction } from "i18next";
import { IdentitySourceEnabledSwitch } from "@/domains/identity-source/components/IdentitySourceEnabledSwitch";
import type {
  IdentitySource,
  IdentitySourceLDAPSpec,
  IdentitySourceOIDCSpec,
} from "@/domains/identity-source/types";
import { ConnectionTestResult } from "@/foundation/role/ConnectionTestResult";
import { type DetailField, field } from "@/foundation/scene/detail-field";

/** An absent CA means the system trust store verifies the server. */
const caCert = (stored: string | null | undefined, t: TFunction) =>
  stored
    ? t("identity_sources.values.caConfigured")
    : t("identity_sources.values.systemTrust");

export const identitySourceHeaderFields: DetailField<IdentitySource>[] = [
  field("common.fields.name", (source) => source.metadata.name),
  field("common.fields.type", (source, t) =>
    t(`identity_sources.types.${source.spec.type}`),
  ),
];

export const identitySourceStateFields: DetailField<IdentitySource>[] = [
  field("identity_sources.fields.enabled", {
    render: (source) => <IdentitySourceEnabledSwitch record={source} />,
  }),
  field("identity_sources.fields.lastTest", {
    render: (source) => (
      <ConnectionTestResult test={source.status?.last_connection_test} />
    ),
  }),
  field(
    "common.fields.message",
    (source) =>
      source.status?.error_message ||
      source.status?.last_connection_test?.message,
    { span: 2 },
  ),
];

export const identitySourceLdapFields: DetailField<IdentitySourceLDAPSpec>[] = [
  field("identity_sources.fields.ldapUrl", (ldap) => ldap.url),
  field("identity_sources.fields.startTls", (ldap) => ldap.start_tls ?? false),
  field(
    "identity_sources.fields.insecureSkipVerify",
    (ldap) => ldap.insecure_skip_verify ?? false,
  ),
  field("identity_sources.fields.caCert", (ldap, t) => caCert(ldap.ca_cert, t)),
  field("identity_sources.fields.bindDn", (ldap) => ldap.bind_dn),
  field("identity_sources.fields.userBaseDn", (ldap) => ldap.user_base_dn),
  field("identity_sources.fields.userFilter", (ldap) => ldap.user_filter),
  field("identity_sources.fields.timeout", (ldap) => ldap.timeout),
];

export const identitySourceOidcFields: DetailField<IdentitySourceOIDCSpec>[] = [
  field("identity_sources.fields.issuer", (oidc) => oidc.issuer),
  field("identity_sources.fields.clientId", (oidc) => oidc.client_id),
  field("identity_sources.fields.scopes", (oidc) => oidc.scopes),
  field("identity_sources.fields.caCert", (oidc, t) => caCert(oidc.ca_cert, t)),
  field("identity_sources.fields.redirectUrl", (oidc) => oidc.redirect_url, {
    span: 2,
  }),
  field(
    "identity_sources.fields.allowedRedirects",
    (oidc) => oidc.allowed_redirects,
    { span: 2 },
  ),
];
