import { useShow } from "@refinedev/core";
import { IdentitySourceEnabledSwitch } from "@/domains/identity-source/components/IdentitySourceEnabledSwitch";
import { IdentitySourceStatus } from "@/domains/identity-source/components/IdentitySourceStatus";
import type { IdentitySource } from "@/domains/identity-source/types";
import { Loader } from "@/foundation/components/Loader";
import { MetadataTimestampMeta } from "@/foundation/components/MetadataTimestampMeta";
import { ShowPage } from "@/foundation/components/ShowPage";
import Timestamp from "@/foundation/components/Timestamp";
import { useTranslation } from "@/foundation/lib/i18n";

const text = (value?: string | number | null) =>
  value === null || value === undefined || value === "" ? "-" : String(value);

export const IdentitySourcesShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow<IdentitySource>({ queryOptions: { refetchInterval: 10_000 } });
  const record = data?.data;

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  const { ldap, oidc, type } = record.spec;
  const test = record.status?.last_connection_test;
  const yesNo = (value?: boolean | null) =>
    value ? t("identity_sources.values.yes") : t("identity_sources.values.no");

  return (
    <ShowPage record={record} showCurrentBreadcrumb={false}>
      <ShowPage.ObjectHeader
        title={record.metadata.display_name || record.metadata.name}
        status={<IdentitySourceStatus status={record.status} />}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <ShowPage.Meta label={t("common.fields.name")}>
              {record.metadata.name}
            </ShowPage.Meta>
            <ShowPage.Meta label={t("common.fields.type")}>
              {t(`identity_sources.types.${type}`)}
            </ShowPage.Meta>
            <MetadataTimestampMeta metadata={record.metadata} />
          </span>
        }
      />
      <div className="mt-4 space-y-3">
        <ShowPage.Section title={t("identity_sources.sections.state")}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
            <ShowPage.Row title={t("identity_sources.fields.enabled")}>
              <IdentitySourceEnabledSwitch record={record} />
            </ShowPage.Row>
            <ShowPage.Row title={t("identity_sources.fields.lastTest")}>
              {test?.time ? (
                <span className="inline-flex items-center gap-1">
                  {test.ok
                    ? t("identity_sources.values.testOk")
                    : t("identity_sources.values.testFailed")}
                  {" · "}
                  <Timestamp timestamp={test.time} relative />
                </span>
              ) : (
                t("identity_sources.status.notTested")
              )}
            </ShowPage.Row>
            <div className="lg:col-span-2">
              <ShowPage.Row title={t("common.fields.message")}>
                <span className="whitespace-pre-wrap break-words">
                  {text(record.status?.error_message || test?.message)}
                </span>
              </ShowPage.Row>
            </div>
          </div>
        </ShowPage.Section>
        {type === "ldap" && ldap && (
          <ShowPage.Section
            title={t("identity_sources.sections.ldapConnection")}
          >
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
              <ShowPage.Row title={t("identity_sources.fields.ldapUrl")}>
                {text(ldap.url)}
              </ShowPage.Row>
              <ShowPage.Row title={t("identity_sources.fields.startTls")}>
                {yesNo(ldap.start_tls)}
              </ShowPage.Row>
              <ShowPage.Row
                title={t("identity_sources.fields.insecureSkipVerify")}
              >
                {yesNo(ldap.insecure_skip_verify)}
              </ShowPage.Row>
              <ShowPage.Row title={t("identity_sources.fields.caCert")}>
                {ldap.ca_cert
                  ? t("identity_sources.values.caConfigured")
                  : t("identity_sources.values.systemTrust")}
              </ShowPage.Row>
              <ShowPage.Row title={t("identity_sources.fields.bindDn")}>
                {text(ldap.bind_dn)}
              </ShowPage.Row>
              <ShowPage.Row title={t("identity_sources.fields.userBaseDn")}>
                {text(ldap.user_base_dn)}
              </ShowPage.Row>
              <ShowPage.Row title={t("identity_sources.fields.userFilter")}>
                {text(ldap.user_filter)}
              </ShowPage.Row>
              <ShowPage.Row title={t("identity_sources.fields.timeout")}>
                {text(ldap.timeout)}
              </ShowPage.Row>
            </div>
          </ShowPage.Section>
        )}
        {type === "oidc" && oidc && (
          <ShowPage.Section title={t("identity_sources.sections.oidcProvider")}>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
              <ShowPage.Row title={t("identity_sources.fields.issuer")}>
                {text(oidc.issuer)}
              </ShowPage.Row>
              <ShowPage.Row title={t("identity_sources.fields.clientId")}>
                {text(oidc.client_id)}
              </ShowPage.Row>
              <ShowPage.Row title={t("identity_sources.fields.scopes")}>
                {text((oidc.scopes ?? []).join(" "))}
              </ShowPage.Row>
              <ShowPage.Row title={t("identity_sources.fields.caCert")}>
                {oidc.ca_cert
                  ? t("identity_sources.values.caConfigured")
                  : t("identity_sources.values.systemTrust")}
              </ShowPage.Row>
              <div className="lg:col-span-2">
                <ShowPage.Row title={t("identity_sources.fields.redirectUrl")}>
                  {text(oidc.redirect_url)}
                </ShowPage.Row>
              </div>
              <div className="lg:col-span-2">
                <ShowPage.Row
                  title={t("identity_sources.fields.allowedRedirects")}
                >
                  {text((oidc.allowed_redirects ?? []).join(", "))}
                </ShowPage.Row>
              </div>
            </div>
          </ShowPage.Section>
        )}
      </div>
    </ShowPage>
  );
};
