import { useShow } from "@refinedev/core";
import PermissionsTree from "@/domains/role/components/PermissionsTree";
import type { Role } from "@/domains/role/types";
import { Loader } from "@/foundation/components/Loader";
import { MetadataDisclosure } from "@/foundation/components/MetadataDisclosure";
import { MetadataTimestampMeta } from "@/foundation/components/MetadataTimestampMeta";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useTranslation } from "@/foundation/lib/i18n";

export const RolesShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow<Role>();
  const record = data?.data;

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  const isPreset = Boolean(record.spec.preset_key);

  return (
    <ShowPage
      record={record}
      canDelete={!isPreset}
      canEdit={!isPreset}
      showCurrentBreadcrumb={false}
    >
      <ShowPage.ObjectHeader
        title={record.metadata.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <ShowPage.Meta label={t("common.fields.permissions")}>
              {t("common.fields.permissionsCount", {
                count: record.spec.permissions.length,
              })}
            </ShowPage.Meta>
            <ShowPage.Meta label={t("common.fields.type")}>
              {isPreset
                ? t("roles.fields.presetRole")
                : t("roles.fields.customRole")}
            </ShowPage.Meta>
            <MetadataTimestampMeta metadata={record.metadata} />
          </span>
        }
      />
      <div className="mt-4 space-y-4">
        <MetadataDisclosure metadata={record.metadata} />
        <ShowPage.Section
          title={t("common.fields.permissions")}
          data-testid="permissions-card"
        >
          <PermissionsTree permissions={record.spec.permissions} />
        </ShowPage.Section>
      </div>
    </ShowPage>
  );
};
