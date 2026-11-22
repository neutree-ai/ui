import type { TFunction } from "i18next";
import { IdentitySourceEnabledSwitch } from "@/domains/identity-source/components/IdentitySourceEnabledSwitch";
import type {
  IdentitySource,
  IdentitySourceConnectionTest,
  IdentitySourceLDAPSpec,
  IdentitySourceOIDCSpec,
} from "@/domains/identity-source/types";
import { useTranslation } from "@/foundation/lib/i18n";
import Timestamp from "@/foundation/role/Timestamp";
import type { DetailField } from "@/foundation/scene/DetailFields";

/** An absent CA means the system trust store verifies the server. */
const caCert = (stored: string | null | undefined, t: TFunction) =>
  stored
    ? t("identity_sources.values.caConfigured")
    : t("identity_sources.values.systemTrust");

function LastConnectionTest({
  test,
}: {
  test?: IdentitySourceConnectionTest | null;
}) {
  const { t } = useTranslation();

  if (!test?.time) return t("identity_sources.status.notTested");

  return (
    <span className="inline-flex items-center gap-1">
      {test.ok
        ? t("identity_sources.values.testOk")
        : t("identity_sources.values.testFailed")}
      {" · "}
      <Timestamp timestamp={test.time} relative />
    </span>
  );
}

export const identitySourceHeaderFields: DetailField<IdentitySource>[] = [
  {
    key: "name",
    label: "common.fields.name",
    value: (source) => source.metadata.name,
  },
  {
    key: "type",
    label: "common.fields.type",
    value: (source, t) => t(`identity_sources.types.${source.spec.type}`),
  },
];

export const identitySourceStateFields: DetailField<IdentitySource>[] = [
  {
    key: "enabled",
    label: "identity_sources.fields.enabled",
    render: (source) => <IdentitySourceEnabledSwitch record={source} />,
  },
  {
    key: "lastTest",
    label: "identity_sources.fields.lastTest",
    render: (source) => (
      <LastConnectionTest test={source.status?.last_connection_test} />
    ),
  },
  {
    key: "message",
    label: "common.fields.message",
    span: 2,
    value: (source) =>
      source.status?.error_message ||
      source.status?.last_connection_test?.message,
  },
];

export const identitySourceLdapFields: DetailField<IdentitySourceLDAPSpec>[] = [
  {
    key: "url",
    label: "identity_sources.fields.ldapUrl",
    value: (ldap) => ldap.url,
  },
  {
    key: "startTls",
    label: "identity_sources.fields.startTls",
    value: (ldap) => ldap.start_tls ?? false,
  },
  {
    key: "insecureSkipVerify",
    label: "identity_sources.fields.insecureSkipVerify",
    value: (ldap) => ldap.insecure_skip_verify ?? false,
  },
  {
    key: "caCert",
    label: "identity_sources.fields.caCert",
    value: (ldap, t) => caCert(ldap.ca_cert, t),
  },
  {
    key: "bindDn",
    label: "identity_sources.fields.bindDn",
    value: (ldap) => ldap.bind_dn,
  },
  {
    key: "userBaseDn",
    label: "identity_sources.fields.userBaseDn",
    value: (ldap) => ldap.user_base_dn,
  },
  {
    key: "userFilter",
    label: "identity_sources.fields.userFilter",
    value: (ldap) => ldap.user_filter,
  },
  {
    key: "timeout",
    label: "identity_sources.fields.timeout",
    value: (ldap) => ldap.timeout,
  },
];

export const identitySourceOidcFields: DetailField<IdentitySourceOIDCSpec>[] = [
  {
    key: "issuer",
    label: "identity_sources.fields.issuer",
    value: (oidc) => oidc.issuer,
  },
  {
    key: "clientId",
    label: "identity_sources.fields.clientId",
    value: (oidc) => oidc.client_id,
  },
  {
    key: "scopes",
    label: "identity_sources.fields.scopes",
    value: (oidc) => oidc.scopes,
  },
  {
    key: "caCert",
    label: "identity_sources.fields.caCert",
    value: (oidc, t) => caCert(oidc.ca_cert, t),
  },
  {
    key: "redirectUrl",
    label: "identity_sources.fields.redirectUrl",
    span: 2,
    value: (oidc) => oidc.redirect_url,
  },
  {
    key: "allowedRedirects",
    label: "identity_sources.fields.allowedRedirects",
    span: 2,
    value: (oidc) => oidc.allowed_redirects,
  },
];
