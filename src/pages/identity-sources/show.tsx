import { useShow } from "@refinedev/core";
import { IdentitySourceStatus } from "@/domains/identity-source/components/IdentitySourceStatus";
import { IdentitySourceSyncSection } from "@/domains/identity-source/components/IdentitySourceSyncSection";
import {
  identitySourceHeaderFields,
  identitySourceLdapFields,
  identitySourceOidcFields,
  identitySourceStateFields,
} from "@/domains/identity-source/lib/detail-fields";
import { isSyncRequestPending } from "@/domains/identity-source/lib/identity-source-sync";
import type { IdentitySource } from "@/domains/identity-source/types";
import { Loader } from "@/foundation/components/Loader";
import { useTranslation } from "@/foundation/lib/i18n";
import { displayName } from "@/foundation/role/display-name";
import { DetailFields } from "@/foundation/scene/DetailFields";
import { MetadataTimestampMeta } from "@/foundation/scene/MetadataTimestampMeta";
import { ShowPage } from "@/foundation/scene/ShowPage";

export const IdentitySourcesShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow<IdentitySource>({
    queryOptions: {
      // Faster while a requested sync has not reported back.
      refetchInterval: (data) =>
        data?.data && isSyncRequestPending(data.data) ? 3_000 : 10_000,
    },
  });
  const record = data?.data;

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  const { ldap, oidc, type } = record.spec;

  return (
    <ShowPage record={record} showCurrentBreadcrumb={false}>
      <ShowPage.ObjectHeader
        title={displayName(record.metadata)}
        status={<IdentitySourceStatus status={record.status} />}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <DetailFields
              inline
              fields={identitySourceHeaderFields}
              record={record}
            />
            <MetadataTimestampMeta metadata={record.metadata} />
          </span>
        }
      />
      <div className="mt-4 space-y-3">
        <ShowPage.Section title={t("identity_sources.sections.state")}>
          <DetailFields fields={identitySourceStateFields} record={record} />
        </ShowPage.Section>
        {type === "ldap" && ldap && (
          <ShowPage.Section
            title={t("identity_sources.sections.ldapConnection")}
          >
            <DetailFields fields={identitySourceLdapFields} record={ldap} />
          </ShowPage.Section>
        )}
        {type === "ldap" && <IdentitySourceSyncSection record={record} />}
        {type === "oidc" && oidc && (
          <ShowPage.Section title={t("identity_sources.sections.oidcProvider")}>
            <DetailFields fields={identitySourceOidcFields} record={oidc} />
          </ShowPage.Section>
        )}
      </div>
    </ShowPage>
  );
};
